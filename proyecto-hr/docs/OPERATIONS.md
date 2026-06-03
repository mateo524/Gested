# Performia — Operations Manual

## Architecture Overview

```mermaid
flowchart LR
    A[Browser] -->|HTTPS| B[Vercel CDN]
    B -->|Static assets| C[React SPA]
    C -->|API /_/backend/*| D[Render Web Service]
    D -->|Mongoose| E[(MongoDB Atlas)]
    D -->|SMTP| F[Mail Server]
    D -->|S3 / Cloudinary| G[File Storage]
```

## Deployment Structure

| Layer | Platform | Tech | Notes |
|-------|----------|------|-------|
| Frontend | Vercel | React + Vite | Static SPA; env via Vercel dashboard |
| Backend | Render | Express (Node 20+) | Web service; env via Render dashboard |
| Database | MongoDB Atlas | M40+ cluster | Connection string via `MONGO_URI` |
| File storage | S3-compatible OR Cloudinary | | Configured by env vars |
| SMTP | Nodemailer | | Configured by env vars |

## URLs

- **Frontend (prod):** `https://<vercel-project>.vercel.app`
- **Backend API (prod):** `https://gested-1-backend.onrender.com` (or via Vercel proxy `/_/backend`)
- **Backend health:** `<backend>/health`
- **Local dev:** `http://localhost:5173` (frontend) → `http://localhost:3000` (backend)

## Environment Variables Reference

### Backend (`backend/.env` or Render dashboard)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | — | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | — | Signing key (min 32 chars for production) |
| `PORT` | No | `3000` | Express listen port |
| `FRONTEND_URL` | No | — | Single allowed CORS origin |
| `FRONTEND_ORIGINS` / `CORS_ORIGINS` | No | — | Comma-separated CORS origins |
| `ALLOW_VERCEL_PREVIEWS` | No | `true` | Allow `*.vercel.app` CORS |
| `CLOUDINARY_CLOUD_NAME` | No* | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | No* | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No* | — | Cloudinary API secret |
| `CLOUDINARY_FOLDER` | No | `performia` | Upload folder prefix |
| `S3_ENDPOINT` | No* | — | S3-compatible endpoint |
| `S3_REGION` | No* | — | S3 region |
| `S3_BUCKET` | No* | — | S3 bucket name |
| `S3_ACCESS_KEY_ID` | No* | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No* | — | S3 secret key |
| `S3_PUBLIC_BASE_URL` | No | — | Public URL prefix for S3 objects |
| `AUTOMATION_TOKEN` | No | — | Token for internal automation calls |
| `ALLOW_DEMO_SEED` | No | `false` | Enable demo seed scripts |
| `SEED_ADMIN_EMAIL` | No | — | Admin email for initial seed |
| `SEED_ADMIN_PASSWORD` | No | — | Admin password for initial seed |
| `SEED_ADMIN_NAME` | No | — | Admin display name for initial seed |
| `SEED_COMPANY_NAME` | No | — | Company name for initial seed |
| `SEED_COMPANY_SLUG` | No | — | Company slug for initial seed |
| `SEED_SCHOOL_NAME` | No | — | School name for initial seed |
| `SUPPORT_CACHE_TTL_MS` | No | `120000` | Support endpoint cache TTL |
| `SUPPORT_RATE_WINDOW_MS` | No | `60000` | Rate limit window |
| `SUPPORT_RATE_MAX_REQUESTS` | No | `20` | Max requests per window |

\* File storage is optional: either S3 _or_ Cloudinary (or neither for dev).

### Frontend (`.env.local` or Vercel dashboard)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | auto-detected | Backend API base URL |

> The frontend auto-detects the API URL from `window.location.origin` in production, so `VITE_API_URL` is typically only needed for local development.

## Demo Credentials

After running `scripts/seed-pilot.mjs`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@demo.com` | `123456` |
| SUPER_ADMIN | `superadmin.demo@performia.test` | `Demo1234!` |
| ORG_ADMIN | `orgadmin.demo@performia.test` | `Demo1234!` |
| HR | `hr.demo@performia.test` | `Demo1234!` |
| MANAGER | `manager.demo@performia.test` | `Demo1234!` |
| EMPLOYEE | `employee.demo@performia.test` | `Demo1234!` |
| VIEWER | `viewer.demo@performia.test` | `Demo1234!` |
| AUDITOR | `auditor.demo@performia.test` | `Demo1234!` |

Additional seed data lives in `scripts/seed-demo.mjs` (richer dataset for full demos).

## Common Operational Tasks

### Seed / Reset Demo Data

```bash
# Run pilot seed (safe, idempotent)
SEED_CONFIRM=1 node scripts/seed-pilot.mjs

# Dry-run first to see what would be created
node scripts/seed-pilot.mjs --dry-run

# Reset demo user passwords to defaults
SEED_CONFIRM=1 node scripts/seed-pilot.mjs --reset-passwords
```

### Run Validation Matrix

```bash
node scripts/seedValidationMatrix.js
```

### Post-Deploy Smoke Test

```bash
SMOKE_API_URL=https://gested-1-backend.onrender.com \
  SMOKE_EMAIL=admin@demo.com \
  SMOKE_PASSWORD=123456 \
  node scripts/smokeTestPostDeploy.js
```

### View Logs

- **Render:** Dashboard → Service → Logs tab (streaming or historical)
- **Vercel:** Dashboard → Project → Functions → Logs
- **MongoDB Atlas:** Cluster → Monitoring → Logs

### Rollback Deployment

- **Vercel:** Dashboard → Project → Deployments → ⋯ → Promote to Production (previous deployment)
- **Render:** Dashboard → Service → Manual Deploy → Deploy last successful deploy

## Troubleshooting

### 504 Gateway Timeout

- Backend response exceeds Render's 30s (free) / 300s (paid) timeout.
- Check for slow MongoDB queries: add indexes or optimize aggregation pipelines.
- Check `SUPPORT_CACHE_TTL_MS` — reduce if cache miss is expensive.

### CORS Errors

- Verify `FRONTEND_URL` or `FRONTEND_ORIGINS` includes the requesting domain.
- For Vercel preview deployments, ensure `ALLOW_VERCEL_PREVIEWS=true` (default).
- If backend is accessed via Vercel proxy (`/_/backend`), the origin is the Vercel domain.

### JWT Expired

- Users see `401` with token expiry message.
- Default JWT expiry is configured in `routes/auth.routes.js`.
- No way to extend individual tokens — user must re-login.

### Seed Script Fails

```bash
# Common causes:
# 1. Backend not running — start with `npm start` from backend/
# 2. Network error — check MONGO_URI and connectivity
# 3. Duplicate key — seed is idempotent, check error for specific conflict

# Debug with:
node scripts/seed-pilot.mjs --dry-run
# Then check backend logs for actual error.
```

### Login Returns 401

- Verify credentials against the correct environment (dev vs prod).
- Check if `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` were changed after initial seed.
- If using the demo tenant, ensure `scripts/seed-pilot.mjs` was executed.
- Backend logs will show `POST /auth/login` result with reason.
