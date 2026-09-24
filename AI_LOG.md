# AI Interaction & Verification Log (AI_LOG.md)

This log records external AI-assisted generations, prompts, accepted outputs, rejected outputs, and the verification methods performed during development.

---

## Entry 1: Idempotency & Readiness Calculation Service
- **Tool:** Google Antigravity AI Assistant
- **Material Prompt:**
  > "Implement the transactional attempt creation service for POST /api/students/:id/attempts using PostgreSQL and Prisma. Ensure that repeated requests with the same Idempotency-Key return the original response without creating duplicate database rows, while requests with the same key but different body return a 409 conflict. Atomically update the student's readiness status and current score."
- **Accepted Output:**
  - Hashing request payload using `sha256` to create a deterministic fingerprint.
  - Using `prisma.$transaction` to perform check-and-insert for `IdempotencyRecord` alongside `Attempt` creation.
  - Recomputing weighted average using the latest non-voided attempt per competency with deterministic tie-breaking on `(submittedAt DESC, id DESC)`.
- **Rejected Output:**
  - An initial suggestion proposed checking idempotency in an external Redis key before opening the database transaction.
  - *Reason for Rejection:* Redis operations outside the database transaction create a distributed dual-write race condition: if the PostgreSQL commit fails, the Redis key would hold an uncommitted ghost result. Keeping `IdempotencyRecord` in PostgreSQL inside the transaction guarantees ACID atomicity.
- **Verification Performed:**
  - Automated test `tests/concurrency-and-resilience.test.ts` launching two concurrent `Promise.all` requests with identical idempotency keys, confirming only 1 attempt is inserted into PostgreSQL and both return HTTP 201.

---

## Entry 2: Readiness Domain Logic & Fast-Check Property Test
- **Tool:** Google Antigravity AI Assistant
- **Material Prompt:**
  > "Create a pure domain function `calculateReadiness` that takes competency definitions and student attempts, filters out voided attempts, picks the latest attempt by date (tie-broken by attempt ID), and calculates the weighted mean score. If any required competency is missing, mark status as INCOMPLETE."
- **Accepted Output:**
  - Standalone pure TypeScript function `src/domain/readiness.ts`.
  - Invariant property-based test using `fast-check` across arbitrary scores in `[0, 100]`.
  - Boundary threshold tests (e.g. 79.99 vs 80.00, 64.99 vs 65.00, 49.99 vs 50.00).
- **Rejected Output:**
  - An initial proposal hard-coded the four competencies (`frontend`, `backend`, `databases`, `problem-solving`) as fixed object properties rather than dynamically evaluating the provided competency array.
  - *Reason for Rejection:* Violates the requirement to allow dynamic competency sets (e.g., adding a fifth competency without changing every layer).
- **Verification Performed:**
  - Ran `vitest run tests/readiness.test.ts` executing 13 test cases and 200 random property-based generative iterations.

---

## Entry 3: Seeded Defect Fix & Tenant Isolation Enforcement
- **Tool:** Google Antigravity AI Assistant
- **Material Prompt:**
  > "Identify how fast account switching or cross-tenant spoofing can leak student data. Correct the trust boundaries in auth, routes, and controllers so client-supplied tenant identifiers are never trusted for authorization."
- **Accepted Output:**
  - Strict enforcement of `req.user.tenantId` extracted exclusively from the cryptographically verified JWT access token.
  - Query parameters and request body fields containing `tenantId` are discarded or forbidden.
  - Route handlers return safe non-disclosing 404 responses for cross-tenant resource lookups.
- **Rejected Output:**
  - A suggested client-side filter in React to hide records where `tenantId !== currentTenant.id`.
  - *Reason for Rejection:* As stated in the specification: "A UI-only filter is not an acceptable correction." Security and tenant scoping must be enforced strictly at the database query trust boundary.
- **Verification Performed:**
  - Automated multi-tenant integration test `tests/concurrency-and-resilience.test.ts` confirming that rapid switching between Tenant 1 and Tenant 2 tokens maintains strict isolation, and query parameter spoofing (`?tenantId=...`) is ignored.
