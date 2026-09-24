# Architecture Decisions & Engineering Trade-Offs

## 1. Idempotency Key Storage in PostgreSQL vs. Redis
- **Decision:** Persist `IdempotencyRecord` in PostgreSQL inside the same transactional boundary as the `Attempt` insertion and `Student` readiness recomputation.
- **Trade-off:**
  - *Benefits:* Atomic consistency. The creation of the attempt, the update of student version/score, and the storage of the idempotency response happen within a single ACID transaction (`$transaction`). If any part fails, the entire transaction rolls back, preventing phantom idempotency locks.
  - *Costs:* Higher write overhead on the relational database compared to an in-memory Redis key with TTL.
  - *Justification:* In financial and high-stakes evaluation systems, correctness and replay integrity supersede marginal write latency gains.

## 2. Event Reliability & Separation of Concerns (Dual-Database Consistency)
- **Decision:** Treat PostgreSQL as the strict relational source of truth and MongoDB as an append-only operational event store with asynchronous retry safety.
- **Trade-off:**
  - *Benefits:* Decouples operational log ingestion from relational commits. MongoDB outages or latency spikes will never cause a committed student attempt to roll back or return a false 500 error to the evaluator.
  - *Costs:* Eventual consistency for MongoDB operational events. Events are written immediately when Mongo is available, but in case of network timeouts or outages, events are held in a retry queue with exponential backoff.
  - *Justification:* True distributed 2PC (Two-Phase Commit) between PostgreSQL and MongoDB is anti-pattern and introduces distributed deadlocks. Using PostgreSQL transactions for truth + retry-safe upserts (`$setOnInsert`) for MongoDB provides resilience without compromising relational integrity.

## 3. Optimistic Concurrency Control (OCC) vs. Pessimistic Locking for Updates
- **Decision:** Implement version-based optimistic concurrency control (`Student.version`) on `PATCH /api/students/:id`.
- **Trade-off:**
  - *Benefits:* High throughput for concurrent read operations without database lock contention. Protects against "lost update" anomalies by requiring client to provide the `expectedVersion`.
  - *Costs:* Stale write requests are rejected with HTTP 409 Conflict, requiring the client to refresh and re-submit changes.
  - *Justification:* Concurrent administrative updates to student profiles are relatively infrequent, making optimistic concurrency far more performant and resilient to connection drops than holding open database locks.

## 4. Consciously Deferred Improvement: Distributed Outbox Queue
- **Deferred Item:** Offloading MongoDB event dispatching to an external persistent message broker (such as Kafka, RabbitMQ, or AWS SQS) using Postgres Change Data Capture (Debezium).
- **Reasoning:** In this assessment iteration, an in-process retry worker and direct idempotent MongoDB upserts (`eventId` unique constraint) guarantee retry safety and high performance without introducing external broker infrastructure dependencies. A dedicated distributed worker should be implemented when event publishing throughput exceeds 5,000 events/second.
