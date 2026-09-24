# Live Defense & Walkthrough Guide (DEFENSE_NOTES.md)

## 1. Trace of One Attempt Through the Stack
- **Browser Event:** Evaluator clicks "Submit Attempt" on the frontend modal. The UI validates inputs (score 0–100, competency selected), disables the submit button to block double clicks, generates an `Idempotency-Key` header, and dispatches `POST /api/students/:id/attempts`.
- **Validation & Authorization:** Express router passes the request through `authenticate` middleware, which verifies the Bearer JWT access token and binds `req.user = { id, tenantId, role }`. `permit('ADMIN', 'EVALUATOR')` verifies the role. Zod validates payload against `attemptInputSchema`.
- **Relational ACID Transaction:**
  - Prisma opens a PostgreSQL transaction (`prisma.$transaction`).
  - Checks `idempotencyRecord` table for `(tenantId, key)`. If found with matching SHA-256 fingerprint, replays stored response without creating duplicate rows.
  - Verifies student exists and belongs strictly to `req.user.tenantId` (returns safe 404 if cross-tenant).
  - Inserts attempt row in `Attempt` table with `studentId, competencyId, evaluatorId, score, requestId`.
  - Recomputes student readiness: queries latest non-voided attempts ordered by `submittedAt DESC, id DESC`. Evaluates weighted mean across required competencies.
  - Updates `Student.currentScore`, `readinessStatus`, and increments `version` by 1.
  - Stores response payload in `IdempotencyRecord`.
  - Commits transaction.
- **MongoDB Operational Logging:**
  - `recordAttemptEvent` asynchronously upserts an `attempt.succeeded` event into MongoDB `activity_events` collection by unique `eventId`. If MongoDB has a temporary network timeout, the event is held in an in-process retry buffer with exponential backoff, preventing false transaction rollbacks.
- **Response:**
  - Server returns HTTP 201 with `{ success: true, data: { attempt, student, readiness } }` and header `X-Idempotency-Replayed: false`.

---

## 2. Parallel Requests Demonstration
- Two concurrent requests sent with the exact same `Idempotency-Key`:
  - Request 1 acquires insertion rights in the transaction and commits attempt ID `X`.
  - Request 2 hits the unique constraint on `(tenantId, key)`, catches `P2002` or finds existing record, verifies fingerprint, and returns the stored outcome with `X-Idempotency-Replayed: true`.
  - Database count of attempts created equals **1**. Verified by automated test in `tests/concurrency-and-resilience.test.ts`.

---

## 3. Cross-Tenant Denial Demonstration
- Request from Tenant B targeting Tenant A's student (`GET /api/students/<tenant_a_student_id>`):
  - Handler queries `WHERE id = :studentId AND tenantId = :reqUserTenantId`.
  - Returns HTTP 404 `STUDENT_NOT_FOUND` with safe non-disclosing message.
  - It does NOT leak whether the ID exists in another tenant (preventing enumeration oracle attacks).
  - Verified by `tests/api.test.ts` and `tests/concurrency-and-resilience.test.ts`.

---

## 4. Failure Handled vs. Consciously Deferred Limitation
- **Failure Handled:** Temporary MongoDB outage or network partition following a committed PostgreSQL transaction. Handled via retry-safe upserts (`$setOnInsert`) and an in-process retry buffer. The client receives their 201 confirmation without false relational rollback.
- **Deferred Limitation:** In a horizontally scaled multi-instance cluster, in-process memory queues do not share state. Production should transition the outbox pattern to a dedicated Postgres outbox table with `pg_notify` or Kafka worker using `SKIP LOCKED`.

---

## 5. Live Defense Change Requests Prepared

### Change 1: Add a Fifth Competency Without Hard-Coding Every Layer
- **Implementation:** Simply insert a new row in the `Competency` table:
  ```sql
  INSERT INTO "Competency" (id, key, name, weight, required) VALUES (gen_random_uuid(), 'devops', 'DevOps & CI/CD', 20, true);
  ```
  Update existing weights so total equals 100%. The domain calculation engine in `src/domain/readiness.ts` dynamically evaluates all competencies returned by `prisma.competency.findMany()`, so no controllers, routes, or algorithms require hard-coded code edits.

### Change 2: Change a Readiness Threshold
- **Implementation:** Modify the threshold constants in `src/domain/readiness.ts` (e.g., change `READY` from 80 to 85) and update the boundary tests in `tests/readiness.test.ts`.

### Change 3: Add a Filter Preserving URL State, Cancellation, and Stable Pagination
- **Implementation:**
  - In backend: add field to `studentListQuerySchema` in `student.validator.ts` and append to `where` clause in `student.service.ts`.
  - In frontend: add query param to `updateUrlParams` in `App.tsx` and pass through `api.students.list()`.

### Change 4: Correct an Evaluator Mass-Assignment Defect
- **Implementation:** Enforce strict Zod allowlisting on `PATCH /api/students/:id`. Never use `Object.assign(student, req.body)` or `data: { ...req.body }`. Only allowlisted fields `name` and `email` are processed.
