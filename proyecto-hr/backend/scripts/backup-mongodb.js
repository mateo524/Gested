/**
 * backup-mongodb.js — ZENTOR nightly MongoDB backup
 *
 * What it does:
 *   1. Runs mongodump against $MONGO_URI
 *   2. Compresses the dump to a .gz archive named with the current timestamp
 *   3. Uploads the archive to GCS bucket `zentor-backups`
 *   4. Falls back to keeping the local file if GCS is not configured
 *   5. Removes all temp files regardless of outcome
 *
 * Dev dependency needed (install once):
 *   npm install --save-dev @google-cloud/storage
 *
 * Required env vars:
 *   MONGO_URI           — MongoDB connection string
 *   GCS_KEY_FILE        — (optional) path to GCP service-account JSON key.
 *                         When running on Cloud Run / GCE the default
 *                         Application Default Credentials are used instead.
 *   BACKUP_BUCKET       — (optional) override bucket name (default: zentor-backups)
 *
 * Usage:
 *   node backup-mongodb.js
 */

import { execSync } from "node:child_process";
import { createWriteStream, existsSync, rmSync, mkdirSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";

// ── helpers ────────────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  const entry = { severity: level.toUpperCase(), message: msg, timestamp: new Date().toISOString(), ...meta };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

function cleanup(...paths) {
  for (const p of paths) {
    try {
      if (existsSync(p)) rmSync(p, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not set");

  const bucket = process.env.BACKUP_BUCKET || "zentor-backups";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpDir = path.join(os.tmpdir(), `zentor-dump-${timestamp}`);
  const archivePath = path.join(os.tmpdir(), `zentor-backup-${timestamp}.gz`);

  log("INFO", "Starting MongoDB backup", { timestamp, bucket });

  // 1. mongodump ─────────────────────────────────────────────────────────
  mkdirSync(dumpDir, { recursive: true });
  try {
    execSync(
      `mongodump --uri="${mongoUri}" --out="${dumpDir}" --gzip`,
      { stdio: "inherit" }
    );
    log("INFO", "mongodump completed", { dumpDir });
  } catch (err) {
    cleanup(dumpDir);
    throw new Error(`mongodump failed: ${err.message}`);
  }

  // 2. Compress to a single .gz stream ───────────────────────────────────
  // We create a tar-like archive by piping through gzip.
  // mongodump --gzip already compresses individual BSON files, so we wrap
  // the whole directory in a second gzip for a single uploadable blob.
  try {
    execSync(
      `tar -czf "${archivePath}" -C "${os.tmpdir()}" "${path.basename(dumpDir)}"`,
      { stdio: "inherit" }
    );
    log("INFO", "Archive created", { archivePath });
  } catch (err) {
    cleanup(dumpDir, archivePath);
    throw new Error(`Compression failed: ${err.message}`);
  }

  // 3. Upload to GCS ─────────────────────────────────────────────────────
  const gcsConfigured =
    process.env.GCS_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    // When running on GCP infrastructure, ADC is available without any env var
    process.env.METADATA_SERVER_AVAILABLE; // set in cloud-scheduler-backup.yaml

  if (gcsConfigured) {
    try {
      // Dynamic import so the script won't crash if the package isn't installed
      // in non-backup environments (e.g. local dev without the devDep).
      const { Storage } = await import("@google-cloud/storage");

      const storageOptions = {};
      if (process.env.GCS_KEY_FILE) {
        storageOptions.keyFilename = process.env.GCS_KEY_FILE;
      }

      const storage = new Storage(storageOptions);
      const destFileName = `${timestamp}/zentor-backup-${timestamp}.tar.gz`;

      await storage.bucket(bucket).upload(archivePath, {
        destination: destFileName,
        metadata: {
          contentType: "application/gzip",
          metadata: { createdBy: "zentor-backup-script", timestamp },
        },
      });

      log("INFO", "Backup uploaded to GCS", { bucket, destFileName });
    } catch (err) {
      log("WARNING", "GCS upload failed — local backup retained", {
        archivePath,
        error: err.message,
      });
      cleanup(dumpDir);
      return; // keep the local archive
    }
  } else {
    log("WARNING", "GCS not configured — backup kept locally", { archivePath });
    cleanup(dumpDir);
    return; // keep the local archive
  }

  // 4. Cleanup ───────────────────────────────────────────────────────────
  cleanup(dumpDir, archivePath);
  log("INFO", "Backup complete — temp files removed");
}

run().catch((err) => {
  process.stderr.write(
    JSON.stringify({
      severity: "ERROR",
      message: "Backup script failed",
      error: err.message,
      timestamp: new Date().toISOString(),
    }) + "\n"
  );
  process.exit(1);
});
