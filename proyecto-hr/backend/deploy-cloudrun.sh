#!/usr/bin/env bash
# =============================================================================
# deploy-cloudrun.sh — Deploy zentor-backend to Google Cloud Run
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Docker installed and configured for GCR (gcloud auth configure-docker)
#   - Cloud Run API and Container Registry API enabled in your project
#
# Usage:
#   chmod +x deploy-cloudrun.sh
#   ./deploy-cloudrun.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these two values before running
# ---------------------------------------------------------------------------
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"

# Derived values
IMAGE="gcr.io/${PROJECT_ID}/zentor-backend"
SERVICE_NAME="zentor-backend"

echo "==> [1/4] Setting active GCP project to: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "==> [2/4] Building and pushing Docker image via Cloud Build"
# Cloud Build reads cloudbuild.yaml from the repo root.
# Run from the repo root so the dir: 'proyecto-hr/backend' path resolves correctly.
gcloud builds submit \
  --config cloudbuild.yaml \
  --project "${PROJECT_ID}" \
  .

echo "==> [3/4] Deploying image to Cloud Run (region: ${REGION})"
# --allow-unauthenticated  — remove this flag if you want IAM-protected endpoints
# --min-instances 0        — scale to zero when idle (cost-efficient)
# --max-instances 3        — cap concurrent instances
# --memory 512Mi           — adjust as needed
# --cpu 1                  — adjust as needed
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --port 8080 \
  --set-env-vars "\
NODE_ENV=production,\
MONGO_URI=${MONGO_URI:?MONGO_URI env var is required},\
JWT_SECRET=${JWT_SECRET:?JWT_SECRET env var is required},\
SENDGRID_API_KEY=${SENDGRID_API_KEY:?SENDGRID_API_KEY env var is required},\
CONTACT_NOTIFICATIONS_TO=${CONTACT_NOTIFICATIONS_TO:-sanchgon@sadesa.com},\
LINKEDIN_CLIENT_ID=${LINKEDIN_CLIENT_ID:?LINKEDIN_CLIENT_ID env var is required},\
LINKEDIN_CLIENT_SECRET=${LINKEDIN_CLIENT_SECRET:?LINKEDIN_CLIENT_SECRET env var is required},\
LINKEDIN_REDIRECT_URI=${LINKEDIN_REDIRECT_URI:?LINKEDIN_REDIRECT_URI env var is required},\
FRONTEND_URL=${FRONTEND_URL:?FRONTEND_URL env var is required}"

echo "==> [4/4] Deployment complete"
echo "    Service URL:"
gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --format "value(status.url)"
