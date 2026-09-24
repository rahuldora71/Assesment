# Student Readiness Control Center Backend

A multi-tenant assessment and readiness control center backend built with Node.js, Express, TypeScript, PostgreSQL (via Prisma), and MongoDB.

## Features & Architecture

- **Multi-Tenant Scoping:** Every authenticated request is bound to a single tenant extracted from a signed JWT access token. Client-supplied tenant IDs are never trusted for authorization.
- **Readiness Engine:** Computes readiness dynamically using data-driven competencies (Frontend 30%, Backend 30%, Databases 25%, Problem Solving 15%). Deterministically resolves ties using `(submittedAt DESC, id DESC)` and handles missing competencies by setting status to `INCOMPLETE`.
- **Idempotent Attempt Submission:** `POST /api/students/:id/attempts` enforces the `Idempotency-Key` header with SHA-256 fingerprinting. Prevents duplicate attempts during mobile network retries and returns `409 Conflict` on payload mismatch.
- **Optimistic Concurrency Control:** `PATCH /api/students/:id` requires `version` and returns `409 STALE_VERSION` if the resource was modified concurrently.
- **MongoDB Operational Logging:** Records retry-safe `attempt.succeeded` and `attempt.rejected` events in MongoDB `activity_events` with unique `eventId` indexing, in-process retry buffer, and a 24-hour tenant metrics aggregation endpoint.
- **Security & Error Envelopes:** Standardized machine-readable error responses with `code`, `message`, `requestId`, and optional `fieldErrors`. Stack traces and credentials are never leaked. Cross-tenant resources return safe, non-disclosing 404 responses.

---

## Getting Started

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure PostgreSQL and MongoDB connection strings and secure JWT secrets are configured.

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate Database Client & Seed Competencies
```bash
npm run prisma:generate
npm run prisma:migrate
npx tsx prisma/seed.ts
```

### 4. Run the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register`: Create organization tenant and admin user.
- `POST /api/auth/login`: Authenticate and receive `accessToken` and HTTP-only `refreshToken` cookie.
- `POST /api/auth/refresh`: Refresh expired access token.
- `POST /api/auth/logout`: Invalidate session cookie.
- `GET /api/auth/me`: Retrieve current authenticated user and tenant.

### Students (`/api/students`)
*All student endpoints require `Authorization: Bearer <accessToken>`.*
- `GET /api/students`: List tenant students with search (`q`), filter (`status`), sorting (`name`, `score`, `createdAt`), and pagination (`page`, `limit`).
- `POST /api/students`: Create a student record in the tenant.
- `GET /api/students/:id`: Get student details, latest attempt per competency, calculated readiness status, and entity version.
- `PATCH /api/students/:id`: Update allowlisted fields (`name`, `email`) with expected `version`.
- `POST /api/students/:id/attempts`: Submit score attempt with `Idempotency-Key` header. Atomically recomputes score and publishes MongoDB event.
- `GET /api/students/:id/activity`: View operational event history for student from MongoDB.
- `GET /api/students/activity/aggregation`: 24-hour tenant assessment metrics (unique attempts, rejection rate, p95 latency, duplicate detection).

---

## Running Verification & Tests

To execute the entire automated test suite:
```bash
npm test
```
Or with vitest directly:
```bash
npx vitest run
```

### Test Coverage Highlights
1. **Domain Logic Tests (`tests/readiness.test.ts`):**
   - Boundary tests for all thresholds (80, 65, 50).
   - Equal-timestamp tie-breaking by ID.
   - 200 random generative property runs using `fast-check`.
2. **API Integration Tests (`tests/api.test.ts`):**
   - Full authentication and registration cycle.
   - Non-disclosing 404 responses for cross-tenant lookups.
   - Optimistic concurrency conflict on stale version.
   - Idempotency replay and conflict detection.
   - MongoDB activity and aggregation endpoints.
3. **Concurrency & Resilience Tests (`tests/concurrency-and-resilience.test.ts`):**
   - Parallel identical requests with same idempotency key persist only one database attempt.
   - Transaction rollback on validation failure.
   - Fast account switch tenant isolation verification.

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma       # Relational models and indexes
│   └── seed.ts             # Default competency seeding
├── src/
│   ├── config/             # DB, Mongo, and Env configuration
│   ├── controllers/        # Request handling and validation
│   ├── domain/             # Pure readiness calculation logic
│   ├── middleware/         # Auth, error, and role middlewares
│   ├── routes/             # Express API routes
│   ├── services/           # Business logic, idempotency, Mongo activity
│   ├── types/              # TypeScript typings
│   ├── utils/              # JWT and password hashing
│   ├── validators/         # Zod schemas
│   ├── app.ts              # Express application configuration
│   └── server.ts           # Server bootstrap
├── tests/                  # Automated integration and unit tests
├── AI_LOG.md               # AI interaction and verification record
├── DECISIONS.md            # Architecture trade-offs documentation
├── INCIDENT.md             # Incident analysis and remediation plan
└── docs/PR_DESCRIPTION.md  # PR summary with risks and rollback plan
```
