# Performia — Production Readiness Checklist

Check each item before promoting to production or after a major deployment.

## Security

- [ ] `JWT_SECRET` is at least 32 characters and not a known/default value
- [ ] CORS origins (`FRONTEND_URL`, `FRONTEND_ORIGINS`) list only trusted domains
- [ ] `ALLOW_VERCEL_PREVIEWS` set to `false` if preview deployments should not access production backend
- [ ] Rate limiting enabled (default 20 req/min for support endpoints)
- [ ] Password policy enforced (minimum length, complexity requirements)
- [ ] `express-mongo-sanitize` active (enabled in `server.js`)
- [ ] Helmet middleware active (enabled in `server.js`)
- [ ] No secrets in code or git history (checked via `git log -p` or secret scanner)
- [ ] `ALLOW_DEMO_SEED` is `false` in production

## Monitoring & Alerting

- [ ] Health endpoint (`/health`) returns 200 and accurate status
- [ ] Smoke test passes against production URL:
  ```bash
  SMOKE_API_URL=<prod-url> SMOKE_EMAIL=<admin> SMOKE_PASSWORD=<pwd> node scripts/smokeTestPostDeploy.js
  ```
- [ ] Backend logs accessible in Render dashboard and retention is adequate
- [ ] Alerts configured for 5xx error spikes (Render dashboard or external tool)
- [ ] Uptime monitoring active (e.g., Render health checks, Pingdom, UptimeRobot)

## Backup & Recovery

- [ ] Automated MongoDB dumps configured (e.g., `mongodump` via cron or Atlas snapshots)
- [ ] Backup retention policy defined (e.g., daily snapshots for 7 days, weekly for 1 month)
- [ ] Recovery drill performed: restore from backup and verify data integrity
- [ ] File storage backups (S3 bucket cross-region replication, or Cloudinary backup)

## Secrets Management

- [ ] All env vars stored in Render/Vercel dashboards (never in `.env` files committed to git)
- [ ] SMTP credentials valid and tested (email notifications flow works end-to-end)
- [ ] Cloudinary/S3 credentials valid and tested (file upload/download works)
- [ ] `AUTOMATION_TOKEN` set if internal automation endpoints are used
- [ ] Rotation policy documented for secrets (e.g., JWT_SECRET rotation every 90 days)
