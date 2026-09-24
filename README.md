# Student Readiness Control Center (Full-Stack)

A complete, production-grade multi-tenant evaluation and assessment system.

## Project Structure

```
├── backend/
│   ├── prisma/             # PostgreSQL schema, migrations, and seeds
│   ├── src/
│   │   ├── config/         # PostgreSQL, MongoDB, and validated env
│   │   ├── controllers/    # API request handlers
│   │   ├── domain/         # Pure readiness calculation engine
│   │   ├── middleware/     # Auth, role check, and standardized errors
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Idempotency, student services, and Mongo activity
│   │   ├── utils/          # JWT tokens & password hashing
│   │   ├── validators/     # Zod schemas
│   │   ├── app.ts          # Express app
│   │   └── server.ts       # Server entrypoint
│   ├── tests/              # 35 unit, invariant, and integration tests
│   ├── DECISIONS.md        # Architecture decisions & trade-offs
│   ├── INCIDENT.md         # Production incident report & recovery plan
│   ├── AI_LOG.md           # AI prompts, outputs, and verification
│   └── docs/PR_DESCRIPTION.md
│
├── frontend/
│   ├── src/
│   │   ├── api/            # Type-safe API client
│   │   ├── components/     # StatusBadge, Navbar, StudentList, Modals, Metrics
│   │   ├── types/          # Frontend domain interfaces
│   │   ├── App.tsx         # Main dashboard layout and view controller
│   │   └── main.tsx        # React 19 entrypoint
│   └── vite.config.ts      # Vite dev server with proxy to backend :5000
```

---

## Quick Start

### 1. Backend Setup & Run
```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2. Frontend Setup & Run
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
cd backend
npm test
```

### Run End-to-End Endpoint Smoke Test
```bash
cd backend
npx tsx tests/e2e-endpoint-smoke.ts
```

### Build Both Projects for Production
```bash
# In the root directory:
npm run build
```
Or individually:
```bash
npm --prefix backend run build
npm --prefix frontend run build
```

---

## Production Deployment

Detailed instructions for deploying **Backend on Render** and **Frontend on Netlify** are documented in:
👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

- **Backend (Render)**: Includes `render.yaml` blueprint, automated Prisma migrations on boot (`npm run prisma:deploy`), MongoDB Atlas connectivity, SSL pooling, and CORS configuration.
- **Frontend (Netlify)**: Includes `netlify.toml`, SPA `_redirects`, and `VITE_API_URL` environment configuration.

