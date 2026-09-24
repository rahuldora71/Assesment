# Infinite Locus Role-Aligned Assessment: Student Readiness Control Center

A production-grade, multi-tenant evaluation and assessment platform built for the **Ultra-Hard Full-Stack Developer Readiness Assessment (150 Marks, 6 Hours)**.

---

## Deliverables & Assessment Mapping

All deliverables required across Parts A, B, C, and D are complete and documented:

| Section | Topic | Marks | Deliverable / Primary File |
| :--- | :--- | :---: | :--- |
| **Part A** | Advanced Engineering Reasoning (9 questions) | 45 | 📄 **[`docs/PART_A_REASONING.md`](./docs/PART_A_REASONING.md)** |
| **Part B** | Production-Grade Full-Stack Build | 75 | 💻 **[`backend/`](./backend)** & **[`frontend/`](./frontend)** |
| **Part C** | Production Incident Investigation & Recovery | 20 | 📄 **[`INCIDENT.md`](./INCIDENT.md)** |
| **Part D** | Live Defense & Walkthrough Guide | 10 | 📄 **[`docs/DEFENSE_NOTES.md`](./docs/DEFENSE_NOTES.md)** |
| **Architecture** | Decisions, Trade-Offs & Deferred Items | — | 📄 **[`DECISIONS.md`](./DECISIONS.md)** |
| **AI Disclosure** | Prompts, Accepted & Rejected Outputs | — | 📄 **[`AI_LOG.md`](./AI_LOG.md)** |
| **Pull Request** | PR Description (Risk, Tests, Rollback) | — | 📄 **[`docs/PR_DESCRIPTION.md`](./docs/PR_DESCRIPTION.md)** |
| **Deployment** | Render & Netlify Production Deployment Guide | — | 📄 **[`DEPLOYMENT.md`](./DEPLOYMENT.md)** |

---

## Live Deployments & Test Credentials

- **Backend (Render)**: [`https://student-readiness-backend.onrender.com`](https://student-readiness-backend.onrender.com)
  - Health check: [`https://student-readiness-backend.onrender.com/api/health`](https://student-readiness-backend.onrender.com/api/health)
- **Frontend (Netlify)**: Ready for deployment via [`netlify.toml`](./netlify.toml) & [`frontend/public/_redirects`](./frontend/public/_redirects).
- **Pre-Configured Test Credentials**:
  - **Organization / Tenant**: `Apex Technical Institute`
  - **Admin Email**: `admin@apex.edu` | **Password**: `Password123!`
  - **Evaluator Email**: `evaluator@apex.edu` | **Password**: `Password123!`
  - *(Note: Tenant ID is auto-derived on login, or enter your registered UUID)*.

---

## Architecture Overview

```
├── backend/
│   ├── prisma/             # PostgreSQL schema, migrations, and seeds
│   ├── src/
│   │   ├── config/         # PostgreSQL (pg.Pool + SSL), MongoDB Atlas, and Zod env
│   │   ├── controllers/    # API request handlers (Auth, Student, Attempt)
│   │   ├── domain/         # Pure readiness calculation engine (30/30/25/15 weighted mean)
│   │   ├── middleware/     # JWT auth, role validation, and sanitized error envelopes
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Idempotency, OCC student updates, and Mongo activity streams
│   │   ├── utils/          # JWT rotation and bcrypt password hashing
│   │   ├── validators/     # Zod request validators
│   │   ├── app.ts          # Express app with dynamic Netlify/Render CORS
│   │   └── server.ts       # Server entrypoint with auto-seed on boot
│   └── tests/              # 35 automated vitest unit, property, and integration tests
│
├── frontend/
│   ├── src/
│   │   ├── api/            # Type-safe API client (VITE_API_URL + token fallback)
│   │   ├── components/     # StatusBadge, Navbar, StudentList, Modals, Metrics
│   │   ├── types/          # Frontend domain interfaces
│   │   ├── App.tsx         # Dashboard controller with 1-click demo login & URL state
│   │   └── main.tsx        # React 19 entrypoint
│   └── vite.config.ts      # Vite dev server with proxy to backend :5000
│
├── docs/
│   ├── PART_A_REASONING.md # Detailed answers & code for all 9 reasoning questions
│   ├── DEFENSE_NOTES.md    # Step-by-step walkthrough & live change recipes
│   └── PR_DESCRIPTION.md   # Pull request summary, tests, and rollback plan
│
├── AI_LOG.md               # Mandatory AI prompts and verification log
├── DECISIONS.md            # 3 architecture trade-offs & 1 deferred item
├── INCIDENT.md             # Complete incident investigation & non-destructive repair
├── DEPLOYMENT.md           # Step-by-step Netlify & Render deployment guide
└── render.yaml             # Render Blueprint specification
```

---

## Seeded Defect Identification & Solution

- **Defect Identified:** In previous iterations, fast tenant switching or client-side caching could leak data from a previously active organization. Additionally, client-supplied `tenantId` query/body parameters could be spoofed.
- **Server-Side Fix:** 
  1. Enforce `tenantId` strictly from the cryptographically verified JWT access token (`req.user.tenantId`).
  2. Discard and ignore all client-supplied `tenantId` parameters in query strings and request bodies.
  3. Return non-disclosing HTTP `404` errors when attempting to query or mutate an entity outside the authenticated tenant.
  4. Scope MongoDB activity logs strictly by `tenantId`.

---

## Quick Start & Local Execution

### 1. Backend Setup
```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173` and proxies `/api` calls directly to `http://localhost:5000`.

---

## Verification & Testing

### Run All Backend Tests (35 Tests)
```bash
npm test
# or inside backend:
npm --prefix backend test
```
All 35 automated test suites pass cleanly across:
- **Domain Logic**: Weighted mean score calculation, tie-breaking on `(submittedAt DESC, id DESC)`, and boundary status thresholds (`INCOMPLETE`, `READY`, `NEARLY_READY`, `DEVELOPING`, `NEEDS_PREPARATION`).
- **Idempotency**: Parallel concurrent requests using `Idempotency-Key` and SHA-256 fingerprinting.
- **Optimistic Concurrency Control**: Entity version validation throwing `409 Conflict` on stale writes.
- **MongoDB Audit Trail**: Event stream capture and multi-tenant aggregation pipeline.

### Build Both Projects for Production
```bash
npm run build
```
Compiles both `backend` (TypeScript `tsc`) and `frontend` (Vite) with 0 type errors.
