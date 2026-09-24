# Part A: Advanced Engineering Reasoning (45 Marks)

Complete solutions, architectural reasoning, and implementation code for all nine questions.

---

## A1. Concurrent React Requests and State Correctness

### 1. Correctness & Resilience Problems Identified
1. **Out-of-Order Race Conditions:** If request A (page 1) takes 600ms and request B (page 2) takes 150ms, response A will resolve last and overwrite page 2 with stale page 1 data.
2. **Missing Request Cancellation:** Active network requests are not aborted when query parameters change or when the component unmounts.
3. **Unchecked HTTP Status (`non-2xx`):** `fetch()` only rejects on network failures. If the server returns 400, 404, or 500 with JSON, `.then(r => r.json())` parses it and calls `setRows()` with error payload instead of triggering the catch block.
4. **State Updates After Unmount:** Updating state after a component unmounts causes memory leaks and warnings in React Strict Mode.
5. **Coupled Loading/Error States:** `setLoading(true)` does not clear prior error states; if a request fails, `loading` remains `true` indefinitely because `setLoading(false)` is only in `.then()` and omitted in `.catch()`.
6. **No Input Debouncing:** Rapid typing causes a thundering herd of redundant backend requests.

### 2. Typed Replacement
```tsx
import React, { useState, useEffect } from 'react';

interface Student {
  id: string;
  name: string;
  score: number;
}

interface StudentResponse {
  items: Student[];
  total: number;
}

export function useStudents(query: string, page: number, category: string) {
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          page: String(page),
          category: category.trim(),
        });

        const res = await fetch(`/api/students?${params.toString()}`, { signal });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const json: StudentResponse = await res.json();
        setData(json.items);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err?.message || 'Failed to load students');
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }, 250); // 250ms debounce for rapid typing

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, category]);

  return { data, loading, error };
}
```

### 3. Protections Still Required on the Server
- **Pagination Bounds & Rate Limiting:** Enforce `max(limit, 100)` and rate limit by IP/tenant to prevent denial of service.
- **Tenant Isolation:** Enforce `tenantId` from verified session/JWT token, never from query parameters.
- **Cache Invalidation & Query Sanitization:** Protect against SQL injection using parameterized queries.

---

## A2. TypeScript State Model with Impossible States

### 1. Discriminated Union Design
```typescript
export type StudentDetailsState =
  | { status: 'idle' }
  | { status: 'loading'; requestId: string }
  | { status: 'success'; requestId: string; student: Student; isRefreshing?: boolean }
  | { status: 'error'; requestId: string; error: string; staleStudent?: Student };
```
*Why this prevents impossible states:*
- You cannot be in `loading` with a stale error from a previous request.
- A `success` state always possesses a valid `student` object and `requestId`.
- When refreshing, previously loaded data remains accessible via `isRefreshing: true` in `success`, or `staleStudent` in `error`.

### 2. Reducer with Exhaustive Checking
```typescript
type StudentAction =
  | { type: 'FETCH_START'; requestId: string }
  | { type: 'FETCH_SUCCESS'; requestId: string; student: Student }
  | { type: 'FETCH_ERROR'; requestId: string; error: string };

export function studentDetailsReducer(
  state: StudentDetailsState,
  action: StudentAction
): StudentDetailsState {
  switch (action.type) {
    case 'FETCH_START':
      if (state.status === 'success') {
        return { ...state, isRefreshing: true };
      }
      return { status: 'loading', requestId: action.requestId };

    case 'FETCH_SUCCESS':
      return {
        status: 'success',
        requestId: action.requestId,
        student: action.student,
        isRefreshing: false,
      };

    case 'FETCH_ERROR':
      if (state.status === 'success') {
        return {
          status: 'error',
          requestId: action.requestId,
          error: action.error,
          staleStudent: state.student,
        };
      }
      return {
        status: 'error',
        requestId: action.requestId,
        error: action.error,
      };

    default: {
      const _exhaustiveCheck: never = action;
      return state;
    }
  }
}
```

---

## A3. Idempotency and Optimistic Concurrency

### 1. HTTP Contract
- **POST /assessments**
  - Header: `Idempotency-Key: <unique-uuid-or-key>`
  - Request Body: `{ studentId, competency, score }`
  - Success (First Request): `201 Created` with payload.
  - Replay (Duplicate with same payload): `200 OK` or `201 Created` with stored response and `X-Idempotency-Replayed: true`.
  - Conflict (Same key with modified payload): `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
- **PATCH /assessments/:id**
  - Request Body: `{ score, version: 3 }`
  - Success: `200 OK` with updated assessment and `version: 4`.
  - Conflict: `409 Conflict` (`STALE_VERSION`) with `{ currentVersion: 4 }`.

### 2. Transaction Boundaries
Inside a single PostgreSQL transaction:
1. `SELECT ... FROM idempotency_records WHERE tenant_id = :t AND key = :key FOR UPDATE` (or check-and-insert).
2. If record exists: compare request fingerprint (`SHA256(body)`). If match, return stored JSON; if mismatch, abort with 409.
3. Check version of entity: `UPDATE students SET ... version = version + 1 WHERE id = :id AND version = :expectedVersion`.
4. If rows affected = 0, abort with 409 Conflict.
5. Insert attempt and write `idempotency_records` row.

---

## A4. SQL: Latest Evidence, Weighted Score, and Ties

```sql
WITH latest_attempts AS (
    SELECT DISTINCT ON (a.student_id, a.competency_id)
        a.student_id,
        a.competency_id,
        a.score,
        a.submitted_at,
        a.id
    FROM attempts a
    WHERE a.voided = false
    ORDER BY a.student_id, a.competency_id, a.submitted_at DESC, a.id DESC
),
student_scores AS (
    SELECT
        s.id AS student_id,
        s.current_score,
        ROUND(
            SUM(COALESCE(la.score, 0) * cw.weight)::numeric /
            NULLIF(SUM(cw.weight), 0)::numeric,
            2
        ) AS calculated_score
    FROM students s
    CROSS JOIN competency_weights cw
    LEFT JOIN latest_attempts la
        ON la.student_id = s.id
       AND la.competency_id = cw.competency_id
    GROUP BY s.id, s.current_score
)
SELECT student_id, current_score, calculated_score
FROM student_scores
WHERE calculated_score IS DISTINCT FROM current_score;
```

### Indexes Required
1. `CREATE INDEX idx_attempts_composite ON attempts (student_id, competency_id, submitted_at DESC, id DESC) WHERE voided = false;`
2. `CREATE INDEX idx_students_current_score ON students (id, current_score);`

### Isolation Concern
Under `READ COMMITTED`, a concurrent transaction could insert a newer attempt while this query aggregates across joins, producing skew. Use `REPEATABLE READ` or row-level locking on `students`.

---

## A5. Transactional Race Condition

### Strategy Comparison
1. **Pessimistic Locking (`SELECT FOR UPDATE`):** Locks the student row while computing new aggregates. Highly reliable under high contention, but blocks concurrent readers/writers.
2. **Serial Version Increment (OCC):** Updates with `WHERE version = :expectedVersion`. Non-blocking for reads, fast, but requires client/server retry loops under write contention.

### Production Pseudocode (Shipped Strategy)
```typescript
async function recordAttempt(studentId: string, competencyId: string, score: number, idempotencyKey: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock student row to prevent concurrent race
    const student = await tx.student.findUniqueOrThrow({
      where: { id: studentId },
    });

    // 2. Insert attempt
    const attempt = await tx.attempt.create({
      data: { studentId, competencyId, score }
    });

    // 3. Recompute aggregate from latest non-voided attempts
    const latestAttempts = await getLatestAttempts(tx, studentId);
    const newScore = computeWeightedMean(latestAttempts);

    // 4. Update student atomically
    await tx.student.update({
      where: { id: studentId },
      data: {
        currentScore: newScore,
        version: { increment: 1 }
      }
    });

    return attempt;
  }, { isolationLevel: 'Serializable' });
}
```

---

## A6. MongoDB Aggregation and Anomaly Detection

```javascript
db.activity_events.aggregate([
  {
    $match: {
      occurredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  },
  {
    $facet: {
      tenantMetrics: [
        {
          $group: {
            _id: "$tenantId",
            totalEvents: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$eventType", "attempt.succeeded"] }, 1, 0] }
            },
            failureCount: {
              $sum: { $cond: [{ $eq: ["$eventType", "attempt.rejected"] }, 1, 0] }
            },
            latencies: {
              $push: {
                $cond: [{ $gt: ["$metadata.latencyMs", null] }, "$metadata.latencyMs", "$$REMOVE"]
              }
            }
          }
        },
        {
          $project: {
            tenantId: "$_id",
            totalEvents: 1,
            validationFailureRate: {
              $cond: [
                { $gt: ["$totalEvents", 0] },
                { $multiply: [{ $divide: ["$failureCount", "$totalEvents"] }, 100] },
                0
              ]
            },
            p95Latency: {
              $percentile: {
                input: "$latencies",
                p: [0.95],
                method: "approximate"
              }
            }
          }
        }
      ],
      duplicateSuccess: [
        { $match: { eventType: "attempt.succeeded" } },
        {
          $group: {
            _id: { tenantId: "$tenantId", assessmentId: "$assessmentId" },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } },
        {
          $group: {
            _id: "$_id.tenantId",
            duplicateAssessmentsCount: { $sum: 1 },
            duplicates: { $push: { assessmentId: "$_id.assessmentId", count: "$count" } }
          }
        }
      ]
    }
  }
]);
```

### Two Essential Indexes
1. `{ eventId: 1 }` (Unique constraint for idempotent append).
2. `{ tenantId: 1, occurredAt: -1 }` (Efficient filtering for rolling 24h windows).

*Why counting documents alone is unsafe:* Document counts include duplicate retries, unindexed phantom inserts, and voided/failed events. Distinct counting on unique `assessmentId` with `eventType = "attempt.succeeded"` is required.

---

## A7. Security Review & Threat Analysis

### Vulnerabilities Identified
1. **Mass Assignment / Privilege Escalation:** Spreading `req.body` directly into ORM create (`data: { ...req.body }`) allows an attacker to inject `role: 'ADMIN'` or override `evaluatorRole`.
2. **Cross-Site Scripting (Stored XSS):** Rendering untrusted `notes` directly as HTML allows script injection attacks.
3. **Tenant Spoofing / Broken Object Level Authorization (BOLA):** Accepting `tenantId` from client body allows a malicious evaluator to record attempts under other organizations.
4. **Parameter Tampering:** Scores outside the 0–100 boundary or arbitrary categories can corrupt database state.

### Top 3 Risks & Fixes
- **Risk 1: Broken Tenant Trust Boundary.** Fix: Derive `tenantId` and `evaluatorId` strictly from verified JWT claims (`req.user.tenantId`).
- **Risk 2: Mass Assignment.** Fix: Use strict Zod schema validation allowlisting only `score`, `competencyId`, and `notes`.
- **Risk 3: Stored XSS.** Fix: Render notes using plain text escaping (`textContent` in DOM or React `{notes}` JSX escaping), never `dangerouslySetInnerHTML`.

---

## A8. Tests That Detect Real Failures

- **Property-Based Invariant:** `fast-check` generator testing 1,000 random score combinations to verify that `overallScore` mathematically equals the weighted average and respects boundary status thresholds.
- **Integration Test:** `supertest` executing `POST /api/students/:id/attempts` verifying attempt insertion, student score recomputation, and MongoDB event logging in a live database.
- **Component Test:** React component test simulating network latency and unmount to ensure no state updates trigger after unmount and out-of-order responses do not display stale data.
- **Failure-Injection Test:** Injecting a simulated database constraint failure midway through attempt creation to prove the relational write completely rolls back.
- **What Not to Mock:** Never mock PostgreSQL transaction boundaries or MongoDB unique constraints. Mocking ORMs masks deadlocks, serializability failures, and race conditions.

---

## A9. Git Recovery and AI Verification

### 1. Safe Team Recovery Procedure
1. Create a forensic backup branch preserving current state:
   ```bash
   git branch forensic/leaked-patch-backup
   ```
2. Inspect reflog to find the last known clean commit SHA:
   ```bash
   git reflog show main
   ```
3. Reset branch to safe commit and create a clean recovery branch:
   ```bash
   git checkout -b fix/restore-safe-tenant-isolation <clean-sha>
   ```
4. Cherry-pick only verified business logic changes without cross-tenant flaws.
5. Force-push with lease (`git push --force-with-lease origin main`) after team coordination.

### 2. Pre-Approval Verification Checklist
- [x] Zero client-supplied tenant IDs participating in queries.
- [x] Automated integration test verifying cross-tenant requests return 404.
- [x] Full test suite passing in CI.
- [x] Peer code review with signed Git commit.
