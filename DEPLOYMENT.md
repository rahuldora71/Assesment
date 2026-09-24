# Deployment Guide: Netlify (Frontend) & Render (Backend)

This guide walks you through deploying the **Student Placement Readiness Control Center** into production with:
- **Backend**: Hosted on [Render](https://render.com) (Node.js + Express + Prisma + PostgreSQL + MongoDB)
- **Frontend**: Hosted on [Netlify](https://netlify.com) (React 19 + TypeScript + Vite + Tailwind CSS)

---

## 1. Prerequisites & Preparation

1. **GitHub Repository**:
   Make sure you commit and push this repository to GitHub:
   ```bash
   git add .
   git commit -m "chore: prepare production deployment for Netlify and Render"
   git push origin main
   ```

2. **Databases**:
   - **PostgreSQL**: You can create a free PostgreSQL database directly on [Render](https://dashboard.render.com/new/database), [Neon](https://neon.tech), or [Supabase](https://supabase.com).
   - **MongoDB**: You can create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas/database) for activity event logging and aggregation.

---

## 2. Deploying the Backend on Render

### Option A: Automatic Blueprint Deployment (Recommended)
This repository includes a `render.yaml` blueprint:
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will detect `render.yaml` and configure the service automatically.
5. Provide your database secrets (`DATABASE_URL`, `MONGODB_URI`, `FRONTEND_URL`) when prompted.

---

### Option B: Manual Web Service Setup
1. On Render, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `student-readiness-backend` (or your preferred name)
   - **Region**: Choose the region closest to your users / database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run prisma:deploy && npm start`
   - **Plan**: `Free`
4. Expand **Advanced** and set **Health Check Path** to:
   ```
   /api/health
   ```
5. Add the **Environment Variables**:
   | Key | Value / Example | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production cookies & optimizations |
   | `PORT` | `10000` | Render standard port |
   | `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Your PostgreSQL connection URI |
   | `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/readiness_events?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI |
   | `ACCESS_TOKEN_SECRET` | Generate a 32+ character random string | Signs short-lived JWT access tokens |
   | `REFRESH_TOKEN_SECRET` | Generate a 32+ character random string | Signs 7-day refresh tokens |
   | `FRONTEND_URL` | `https://<your-app-name>.netlify.app` | You can update this once Netlify provides your URL |

6. Click **Deploy Web Service**.
7. Once deployed, note down your backend URL (e.g. `https://student-readiness-backend.onrender.com`).

---

## 3. Deploying the Frontend on Netlify

1. Log into your [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Connect to **GitHub** and select your repository.
4. Configure the build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist` (or `frontend/dist` if Netlify defaults to root)
5. Expand **Environment variables** and add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://student-readiness-backend.onrender.com` (Your Render URL without trailing slash) |
6. Click **Deploy student-readiness**.
7. Once Netlify finishes building, you will receive a site URL (e.g., `https://sparkling-readiness.netlify.app`).

---

## 4. Final Wiring (CORS & Tokens)

1. Return to your **Render Web Service**:
   - Go to **Environment**.
   - Ensure `FRONTEND_URL` is set to your Netlify site URL (e.g. `https://sparkling-readiness.netlify.app`).
   - Save changes (Render will automatically re-deploy).
   *(Note: The backend CORS configuration is already configured to automatically accept `*.netlify.app` subdomains as well).*

2. Verify the deployment:
   - Open your Netlify URL in your browser.
   - Click **Register / Login** in the upper right.
   - Create a new tenant or account.
   - Create a student, record competency scores (e.g. `DSA`, `SYSTEM_DESIGN`), and observe live readiness calculation, audit trail events, and aggregate metrics.
