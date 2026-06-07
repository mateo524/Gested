# MongoDB Backup — GCP Setup (3 manual steps)

The backup script (`backup-mongodb.js`) runs automatically via Cloud Scheduler and uploads a compressed mongodump archive to Google Cloud Storage. The three things you need to configure once in the GCP Console:

---

## Step 1 — Create the GCS bucket

1. Open **Cloud Storage → Buckets** and click **Create**.
2. Name it `zentor-backups` (or set `BACKUP_BUCKET` env var to override).
3. Choose the same region as your Cloud Run service.
4. Set **Storage class** to `Nearline` (monthly access pattern keeps cost low).
5. Under **Lifecycle**, add a rule to **Delete objects older than 30 days** — this prevents unbounded storage growth.
6. Leave public access blocked (default). Click **Create**.

---

## Step 2 — Grant the Cloud Run service account write access to the bucket

1. In **IAM & Admin → Service Accounts**, find (or create) the service account used by the `zentor-backend` Cloud Run service.
   - If you don't have a dedicated one, create `zentor-backend@<PROJECT_ID>.iam.gserviceaccount.com`.
   - Assign it to Cloud Run: **Cloud Run → zentor-backend → Edit & Deploy → Service account**.
2. Go to **Cloud Storage → Buckets → zentor-backups → Permissions → Grant access**.
3. Add the service account as a principal and assign the role **Storage Object Creator** (or `Storage Object Admin` if the script should also delete old objects directly).

---

## Step 3 — Create the Cloud Scheduler job

1. Open **Cloud Scheduler → Create job**.
2. Fill in:
   - **Name**: `zentor-mongodb-backup`
   - **Region**: same as Cloud Run
   - **Frequency**: `0 3 * * *`
   - **Timezone**: `America/Argentina/Buenos_Aires`
3. Under **Target**:
   - **Target type**: HTTP
   - **URL**: `https://<your-cloud-run-url>/internal/backup`
   - **HTTP method**: POST
   - **Auth header**: OIDC token → select the same service account from Step 2
4. Set **Attempt deadline** to `1800s` (30 min).
5. Enable **Retry on failure** (3 attempts, exponential back-off).
6. Click **Create**.

> **Note:** You will also need to add an `/internal/backup` route in the backend that calls `backup-mongodb.js` (or spawns it as a child process), protected by verifying the OIDC token on the incoming request.
