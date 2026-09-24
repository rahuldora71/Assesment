# Production Incident Investigation & Recovery Plan (INCIDENT.md)

## 1. Incident Overview & Facts
- **Time:** 10:12 UTC (Deployment completed at 10:05 UTC).
- **Reported Symptoms:**
  1. A single click created two attempts (IDs 991 and 992) for student `s44`.
  2. The student's dashboard score oscillated: 78 -> 84 -> 81 after refresh.
  3. Tenant `t-green` briefly saw a student list / name belonging to another tenant (`t-blue`).
- **Application Log Evidence:**
  - `10:12:01.102 req=a91 tenant=t-blue user=u17 POST /students/s44/attempts key=k-778 score=90`
  - `10:12:01.119 req=b03 tenant=t-blue user=u17 POST /students/s44/attempts key=k-778 score=90`
  - `10:12:01.182 req=a91 sql attempt.insert id=991 committed`
  - `10:12:01.190 req=b03 sql attempt.insert id=992 committed`
  - `10:12:01.207 req=a91 mongo event.insert eventId=e-991 success`
  - `10:12:01.211 req=b03 mongo event.insert eventId=e-992 timeout`
  - `10:12:01.244 req=b03 response=201 attemptId=992`
  - `10:12:01.249 req=a91 response=201 attemptId=991`
  - `10:12:04.331 req=c10 tenant=t-green GET /students?status=READY cache=hit cacheKey=students:READY`
- **Schema & Architecture Facts:**
  - `idempotency_records` table had columns `tenant_id, key, response_json, created_at`, but lacked a `UNIQUE(tenant_id, key)` database constraint.
  - The cache key in the 10:05 deployment was shortened from `tenantId:status:page` to `status`.
  - Readiness recalculation occurred in application code outside a serializable/locking database transaction.
  - MongoDB timeout was caught and logged without a durable retry queue.

---

## 2. Independent Failures & Symptom-to-Evidence Mapping

| Symptom | Primary Root Cause | Evidence in Logs & Architecture |
| :--- | :--- | :--- |
| **Duplicate Attempt Creation** | Race condition due to missing unique constraint on `(tenant_id, key)` in `idempotency_records`. | Two concurrent requests (`a91` and `b03`) with `key=k-778` both committed separate inserts (`id=991` at .182s and `id=992` at .190s) within 8ms of each other. |
| **Score Oscillation (78 -> 84 -> 81)** | Non-atomic read-modify-write race in application-level readiness calculation. | Both concurrent transactions read existing attempts at slightly different timestamps, computed scores based on partial states, and blindly overwrote `students.current_score`. |
| **Cross-Tenant Data Leakage** | Tenant identity stripped from cache key in recent deployment (`10:05 UTC`). | Request `c10` from `tenant=t-green` hit `cacheKey=students:READY` at 10:12:04, serving cached student data belonging to `tenant=t-blue`. |
| **Silent Event Loss / Timeout** | MongoDB error swallowed with catch-and-log without durable retry. | Request `b03` logged `event.insert eventId=e-992 timeout`, but returned 201 to the client without queueing the event for retry. |

---

## 3. Immediate Containment Sequence (First 15 Minutes)

1. **Minute 0–3: Mitigate Cross-Tenant Data Leakage**
   - Immediately purge/flush the student list cache.
   - Disable or bypass the caching layer entirely via feature flag or immediate hotfix/rollback of the 10:05 deployment.
2. **Minute 3–7: Announce Incident & Block Duplicate Submissions**
   - Page engineering leads and security incident response.
   - Introduce rate-limiting on `POST /students/:id/attempts` at the API gateway / reverse proxy (1 request per second per user/key).
3. **Minute 7–12: Preserve Evidence**
   - Snapshot production database state, application logs, proxy logs, and MongoDB oplog.
   - Ensure no operator runs destructive deletions (`DELETE FROM attempts`).
4. **Minute 12–15: Communicate Status**
   - Post an internal incident status update notifying stakeholders of containment and beginning data audit.

---

## 4. Durable Corrections

### A. Idempotency Constraint & Atomic Transaction
- Add a database constraint: `ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_tenantId_key_key" UNIQUE ("tenantId", "key");`
- Execute attempt insertion, student readiness recomputation, and idempotency record storage within a single atomic `$transaction`.
- Store SHA-256 fingerprint of `(studentId, competency, score)`. If the same key arrives with a different body, reject with HTTP 409 `IDEMPOTENCY_CONFLICT`.

### B. Tenant-Isolated Cache Keys
- Revert the cache key format to include tenant isolation and full query dimensions:
  `cacheKey = tenant:{tenantId}:students:status:{status}:page:{page}:sort:{sortBy}`
- Reject any cache key generation that lacks an authenticated `tenantId`.

### C. Atomic Score Recomputation & Tie-Breaking
- Recompute score deterministically inside the same relational transaction using:
  `submittedAt DESC, id DESC`.
- Increment `Student.version` to prevent concurrent write collisions.

### D. Event Reliability (Retry-Safe Upserts)
- Use idempotent MongoDB upserts: `updateOne({ eventId }, { $setOnInsert: eventDoc }, { upsert: true })`.
- Introduce an asynchronous retry queue with exponential backoff so MongoDB network hiccups do not lose events or disrupt committed relational attempts.

---

## 5. Safe Data-Repair Approach

1. **Identification of Duplicates (Read-Only Audit Query):**
   ```sql
   SELECT a1.id AS keep_id, a2.id AS duplicate_id, a1.student_id, a1.competency_id, a1.score
   FROM attempts a1
   JOIN attempts a2 ON a1.student_id = a2.student_id
     AND a1.competency_id = a2.competency_id
     AND a1.score = a2.score
     AND a1.id < a2.id
     AND ABS(EXTRACT(EPOCH FROM (a1.submitted_at - a2.submitted_at))) <= 2
   WHERE a1.voided = false AND a2.voided = false;
   ```
2. **Non-Destructive Correction:**
   - Never run `DELETE`.
   - Update `voided = true` on the duplicate attempt (`id = 992`):
     ```sql
     UPDATE attempts SET voided = true WHERE id = '992';
     ```
3. **Recalculation:**
   - Execute a batch recalculation script that recalculates `current_score` and `readiness_status` for all affected students based strictly on non-voided attempts.

---

## 6. Tests, Dashboards, and Alerts

- **Automated Tests:**
  - Concurrent same-key parallel request test verifying only one attempt is persisted.
  - Multi-tenant fast account-switch regression tests.
  - Failure-injection tests verifying transaction rollback.
- **Metrics & Dashboards:**
  - Metric: `idempotency.replayed.count` vs `idempotency.conflict.count`.
  - Metric: `attempts.succeeded` vs `attempts.rejected`.
  - MongoDB retry queue depth and p95 publish latency.
- **Alerts:**
  - Alert on any cache lookup that omits `tenantId` in the cache key.
  - Alert when MongoDB event retry queue size exceeds 50 items for > 2 minutes.

---

## 7. Missing Evidence & Acquisition Method

1. **Client Headers & Body Payloads:**
   - *Missing:* Complete request body and headers for `req=a91` and `req=b03`.
   - *Acquisition:* Enable structured request payload logging at the API gateway with token redaction.
2. **Cache Key Mutation Commit History:**
   - *Missing:* Git commit diff of the 10:05 deployment that shortened the cache key.
   - *Acquisition:* Pull Git log diff for the release tag associated with 10:05 deployment.
3. **Network Telemetry for MongoDB Timeout:**
   - *Missing:* Socket/driver diagnostics explaining the timeout on `e-992`.
   - *Acquisition:* Review MongoDB connection pool metrics, firewall logs, and MongoDB server diagnostic logs (`mongod.log`).
