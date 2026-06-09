<#
.SYNOPSIS
  Upload a local MongoDB backup ZIP to Google Cloud Storage using local gcloud auth.

.DESCRIPTION
  Finds the most recent ZIP in C:\Backups\Zentor (or uses BackupZipPath),
  validates gcloud auth and bucket access, then uploads to:
    gs://<BucketName>/<Prefix>/YYYY-MM-DD/<filename>.zip

  Uses the local gcloud session -- no service account key required.
  Does NOT delete the local backup after upload.

.PARAMETER BackupZipPath
  Full path to a specific ZIP. If omitted, picks the newest .zip in C:\Backups\Zentor.

.PARAMETER BucketName
  Target GCS bucket. Default: zentor-backups-zentor-cloud-credits-guardrail

.PARAMETER Prefix
  Object prefix (folder) inside the bucket. Default: hrdb

.PARAMETER ProjectId
  GCP project ID. Default: zentor-cloud-credits-guardrail

.PARAMETER DryRun
  Switch. Show what would be uploaded without actually uploading.

.EXAMPLE
  # Upload latest backup
  .\scripts\ops\upload-backup-gcs.ps1

.EXAMPLE
  # Dry run -- preview only, no upload
  .\scripts\ops\upload-backup-gcs.ps1 -DryRun

.EXAMPLE
  # Upload specific ZIP
  .\scripts\ops\upload-backup-gcs.ps1 -BackupZipPath "C:\Backups\Zentor\backup-2026-06-05.zip"
#>

[CmdletBinding()]
param(
    [string]$BackupZipPath = "",
    [string]$BucketName   = "zentor-backups-zentor-cloud-credits-guardrail",
    [string]$Prefix        = "hrdb",
    [string]$ProjectId     = "zentor-cloud-credits-guardrail",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n[FAIL] $msg" -ForegroundColor Red; exit 1 }

# --- locate gcloud ---

Write-Step "Locating gcloud"

$gcloudCandidates = @(
    "gcloud",
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

$gcloud = $null
foreach ($c in $gcloudCandidates) {
    try {
        $null = & $c --version 2>&1
        if ($LASTEXITCODE -eq 0) { $gcloud = $c; break }
    } catch { }
}

if (-not $gcloud) {
    Write-Fail "gcloud not found. Install: https://cloud.google.com/sdk/docs/install-sdk"
}
Write-Ok "gcloud: $gcloud"

# --- verify active account ---

Write-Step "Verifying gcloud auth"

$activeAccount = (& $gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>&1) |
    Where-Object { $_ -match "@" } |
    Select-Object -First 1

if (-not $activeAccount) {
    Write-Fail "No active gcloud account. Run: gcloud auth login"
}
Write-Ok "Account: $activeAccount"

# --- verify bucket accessible ---

Write-Step "Verifying bucket access"

$bucketUri = "gs://$BucketName"
$descOutput = & $gcloud storage buckets describe $bucketUri --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Cannot access $bucketUri -- check auth and project. Output: $descOutput"
}
Write-Ok "Bucket: $bucketUri"

# --- resolve backup ZIP ---

Write-Step "Resolving backup ZIP"

if ($BackupZipPath -eq "") {
    $localRoot = "C:\Backups\Zentor"
    if (-not (Test-Path $localRoot)) {
        Write-Fail "Backup folder not found: $localRoot"
    }
    $latest = Get-ChildItem -Path $localRoot -Filter "*.zip" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $latest) {
        Write-Fail "No .zip files found in $localRoot"
    }
    $BackupZipPath = $latest.FullName
}

if (-not (Test-Path $BackupZipPath)) {
    Write-Fail "File not found: $BackupZipPath"
}
if ([System.IO.Path]::GetExtension($BackupZipPath).ToLower() -ne ".zip") {
    Write-Fail "File must have .zip extension: $BackupZipPath"
}

$zipFile   = Get-Item $BackupZipPath
$zipSizeMB = [math]::Round($zipFile.Length / 1MB, 2)
Write-Ok "ZIP: $($zipFile.FullName) ($zipSizeMB MB)"

# --- build destination ---

$datePart   = Get-Date -Format "yyyy-MM-dd"
$objectName = "$Prefix/$datePart/$($zipFile.Name)"
$destUri    = "$bucketUri/$objectName"

# --- summary ---

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Source      : $($zipFile.FullName)"
Write-Host "  Size        : $zipSizeMB MB"
Write-Host "  Destination : $destUri"
Write-Host "  Account     : $activeAccount"
Write-Host "  Project     : $ProjectId"
if ($DryRun) {
    Write-Host "  Mode        : DRY RUN -- no upload" -ForegroundColor Yellow
}
Write-Host "----------------------------------------" -ForegroundColor DarkGray

# --- upload or dry run ---

if ($DryRun) {
    Write-Warn "DryRun active -- skipping upload."
    Write-Host ""
    Write-Host "Command that would run:" -ForegroundColor DarkGray
    Write-Host "  gcloud storage cp `"$($zipFile.FullName)`" `"$destUri`" --project=$ProjectId"
    Write-Host ""
    Write-Host "Restore command (for future reference):" -ForegroundColor DarkGray
    Write-Host "  gcloud storage cp `"$destUri`" `"C:\Backups\Zentor\`" --project=$ProjectId"
    exit 0
}

Write-Step "Uploading"
& $gcloud storage cp $zipFile.FullName $destUri --project=$ProjectId
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Upload failed."
}
Write-Ok "Upload complete."

# --- verify object ---

Write-Step "Verifying object in GCS"
$lsOutput = & $gcloud storage ls -l $destUri --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Object not found after upload: $lsOutput"
}
Write-Ok "Verified:"
Write-Host ($lsOutput | Out-String).Trim()

# --- restore hint ---

Write-Host ""
Write-Host "Restore command (for reference):" -ForegroundColor DarkGray
Write-Host "  gcloud storage cp `"$destUri`" `"C:\Backups\Zentor\`" --project=$ProjectId"
Write-Host ""
Write-Ok "Done. Local backup NOT deleted."
