<#
.SYNOPSIS
  Manual MongoDB Atlas backup via mongodump. Zips the result.

.DESCRIPTION
  Reads MONGO_URI from environment. Dumps the specified database to
  a timestamped folder under OutputRoot, then optionally compresses to ZIP.

.PARAMETER DatabaseName
  Name of the database to dump. Default: hrdb.

.PARAMETER OutputRoot
  Parent directory for the backup folder. Default: C:\Backups\Zentor.

.PARAMETER NoZip
  Switch. If set, skip ZIP compression (keeps only the BSON folder).

.EXAMPLE
  $env:MONGO_URI = "mongodb+srv://user:pass@cluster.mongodb.net/hrdb"
  .\scripts\ops\backup-mongo.ps1

.EXAMPLE
  .\scripts\ops\backup-mongo.ps1 -DatabaseName hrdb -OutputRoot D:\Backups -NoZip
#>

param(
  [string]$DatabaseName = "hrdb",
  [string]$OutputRoot   = "C:\Backups\Zentor",
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"

# ── Validate MONGO_URI ──────────────────────────────────────────────
if (-not $env:MONGO_URI) {
  Write-Host "[ERROR] La variable de entorno MONGO_URI no esta definida." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Antes de ejecutar el backup, establece la variable:"
  Write-Host '    $env:MONGO_URI = "mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/hrdb"'
  Write-Host ""
  Write-Host "  No incluyas la URI real en scripts ni la comitees."
  exit 1
}

# ── Validate mongodump ──────────────────────────────────────────────
$mongodumpPath = Get-Command "mongodump.exe" -ErrorAction SilentlyContinue
if (-not $mongodumpPath) {
  Write-Host "[ERROR] mongodump.exe no encontrado." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Instala MongoDB Database Tools:"
  Write-Host "    https://www.mongodb.com/try/download/database-tools"
  Write-Host "  O via Chocolatey:"
  Write-Host "    choco install mongodb-database-tools"
  exit 1
}

# ── Build paths ─────────────────────────────────────────────────────
$timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
$backupFolder = Join-Path -Path $OutputRoot -ChildPath "backup-$timestamp"
$zipPath = Join-Path -Path $OutputRoot -ChildPath "backup-$timestamp.zip"

# ── Create output folder ────────────────────────────────────────────
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

# ── Run mongodump ───────────────────────────────────────────────────
Write-Host "Iniciando backup de MongoDB..." -ForegroundColor Cyan
Write-Host "  Base de datos : $DatabaseName"
Write-Host "  Destino       : $backupFolder"
Write-Host ""

# Build the URI – strip any trailing database name from MONGO_URI so
# --db is the authoritative source.  mongodump --uri handles auth.
$uri = $env:MONGO_URI

try {
  & $mongodumpPath.Source `
    --uri "$uri" `
    --db $DatabaseName `
    --out $backupFolder `
    --quiet

  if ($LASTEXITCODE -ne 0) {
    throw "mongodump falló con código $LASTEXITCODE"
  }
} catch {
  Write-Host "[ERROR] El backup falló: $_" -ForegroundColor Red
  exit 1
}

# ── Report dump contents ────────────────────────────────────────────
$dumpDbFolder = Join-Path -Path $backupFolder -ChildPath $DatabaseName
if (Test-Path $dumpDbFolder) {
  $fileCount = (Get-ChildItem -LiteralPath $dumpDbFolder -File).Count
  $sizeBytes = (Get-ChildItem -LiteralPath $dumpDbFolder -Recurse | Measure-Object -Property Length -Sum).Sum
  $sizeMB = [math]::Round($sizeBytes / 1MB, 2)
  Write-Host "  Archivos BSON: $fileCount"
  Write-Host "  Tamaño aprox  : $sizeMB MB"
} else {
  Write-Host "[WARN] No se encontró la carpeta de la base de datos. Revisa el dump." -ForegroundColor Yellow
}

# ── Compress to ZIP ─────────────────────────────────────────────────
if (-not $NoZip) {
  Write-Host ""
  Write-Host "Comprimiendo a ZIP..." -ForegroundColor Cyan
  try {
    Compress-Archive -Path $backupFolder -DestinationPath $zipPath -CompressionLevel Optimal
    $zipItem = Get-Item -LiteralPath $zipPath
    $zipSizeMB = [math]::Round($zipItem.Length / 1MB, 2)
    Write-Host "  ZIP generado : $zipPath"
    Write-Host "  Tamaño ZIP   : $zipSizeMB MB"
  } catch {
    Write-Host "[ERROR] No se pudo comprimir: $_" -ForegroundColor Red
    Write-Host "  La carpeta sin comprimir se conserva en: $backupFolder"
  }
}

# ── Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========== RESUMEN ==========" -ForegroundColor Green
Write-Host "  Base de datos : $DatabaseName"
Write-Host "  Backup folder : $backupFolder"
if (-not $NoZip) {
  Write-Host "  ZIP          : $zipPath"
}
Write-Host ""
Write-Host "Para restaurar a una base de prueba:"
Write-Host '  $env:MONGO_URI = "<tu-uri>"'
Write-Host "  .\scripts\ops\restore-mongo-test.ps1 -BackupPath ""$dumpDbFolder"""
Write-Host ""
Write-Host "Backup completado." -ForegroundColor Green
