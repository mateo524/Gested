# ZENTOR — Production Readiness Checklist

> Last updated: 2026-06-03

Check each item before promoting to production or after a major deployment.

## Security

- [ ] `JWT_SECRET` is at least 32 characters and not a known/default value
- [ ] CORS origins (`FRONTEND_URL`, `FRONTEND_ORIGINS`) list only trusted domains
- [ ] `ALLOW_VERCEL_PREVIEWS` set to `false` if preview deployments should not access production backend
- [ ] Rate limiting enabled (login: 10 req/15min, general: 300 req/15min, support: 20 req/min)
- [ ] Password policy enforced (minimum length, complexity requirements)
- [ ] Input sanitization active (custom middleware in `server.js`)
- [ ] Helmet middleware active (enabled in `server.js`)
- [ ] Tenant scope hardening applied to all routes (`attachTenantScope`)
- [ ] No secrets in code or git history (checked via `git log -p` or secret scanner)
- [ ] `ALLOW_DEMO_SEED` is `false` in production
- [ ] `NODE_ENV=production` in Render environment

## Monitoring & Alerting

- [ ] Health endpoint (`/health`) returns 200 and accurate database status
- [ ] External uptime monitor configured (UptimeRobot, Better Stack, or Healthchecks.io)
  - URL: `https://gested-1-backend.onrender.com/health`
  - Interval: 5 minutes
  - Alert on: HTTP != 200 or timeout > 30s
- [ ] Uptime monitor webhook/email configured for on-call engineer
- [ ] Smoke test passes against production URL:
  ```bash
  SMOKE_API_URL=<prod-url> SMOKE_EMAIL=<admin> SMOKE_PASSWORD=<pwd> node scripts/smokeTestPostDeploy.js
  ```
- [ ] Backend logs accessible in Render dashboard and retention confirmed
- [ ] Alertas configuradas en Render para 5xx error spikes (if using Render Pro plan)

## Backup & Recovery

- [ ] Manual backup script configured and tested (`scripts/ops/backup-mongo.ps1`):
  ```powershell
  $env:MONGO_URI = "<uri>"
  .\scripts\ops\backup-mongo.ps1 -NoZip
  ```
- [ ] Backup retention strategy defined (local + private cloud storage)
- [ ] Restore procedure tested: `scripts/ops/restore-mongo-test.ps1` verificado contra `hrdb_restore_test`
- [ ] INCIDENT_RUNBOOK.md reviewed and accessible to on-call team
- [ ] File storage backups verified (S3 cross-region replication or Cloudinary backup)
- [ ] Pre-demo backup checklist reviewed: `scripts/ops/README.md#checklist-pre-demo`

## Secrets Management

- [ ] All env vars stored in Render/Vercel dashboards (never in `.env` files committed to git)
- [ ] SMTP credentials valid and tested (email notifications flow works end-to-end)
- [ ] Cloudinary/S3 credentials valid and tested (file upload/download works)
- [ ] `AUTOMATION_TOKEN` set if internal automation endpoints are used
- [ ] Rotation policy documented for secrets (e.g., JWT_SECRET rotation every 90 days)
- [ ] MongoDB database user has minimum required permissions (`readWrite` on app database only)
- [ ] No hardcoded credentials in source code

## Deployment

- [ ] Build passes with `node --check` on all modified files
- [ ] All 108+ backend tests pass (`npm test` from `backend/`)
- [ ] Frontend builds without errors (`npm run build` from `proyecto-hr/`)
- [ ] Smoke test runs successfully against staging/production
- [ ] Git tag created for this release (`git tag -a v<version> -m "<description>"`)
- [ ] Deploy log checked for errors after deployment

## Post-Deploy

- [ ] Health endpoint returns 200
- [ ] Login works with admin credentials
- [ ] CORS verified from frontend domain
- [ ] Smoke test passes against production
- [ ] Monitoreo externo muestra el sitio como "UP"
