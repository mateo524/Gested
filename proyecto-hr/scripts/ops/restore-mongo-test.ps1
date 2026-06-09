<#
.SYNOPSIS
  Restore a MongoDB backup to a test database. NEVER restores to production.

.DESCRIPTION
  Reads MONGO_URI from environment. Restores the BSON dump at BackupPath
  into TargetDatabase (default: hrdb_restore_test).
  Blocked from restoring over hrdb, production, prod, or admin.

.PARAMETER BackupPath
  Required. Full path to the BSON dump directory (e.g. ...\backup-...\hrdb).

.PARAMETER TargetDatabase
  Target database name. Default: hrdb_restore_test.
  Must NOT be hrdb, production, prod, or admin.

.PARAMETER Drop
  Switch. If set and TargetDatabase is a test DB (*_test), drops the
  target database before restore. Requires interactive confirmation.

.EXAMPLE
  $env:MONGO_URI = "mongodb+srv://user:pass@cluster.mongodb.net/hrdb"
  .\scripts\ops\restore-mongo-test.ps1 -BackupPath "C:\Backups\Zentor\backup-2026-06-03-12-00-00\hrdb"

.EXAMPLE
  .\scripts\ops\restore-mongo-test.ps1 -BackupPath "C:\Backups\Zentor\backup-...\hrdb" -TargetDatabase hrdb_restore_test -Drop
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,

  [string]$TargetDatabase = "hrdb_restore_test",

  [switch]$Drop
)

$ErrorActionPreference = "Stop"

# ── Validate BackupPath ─────────────────────────────────────────────
if (-not (Test-Path -LiteralPath $BackupPath)) {
  Write-Host "[ERROR] La ruta del backup no existe: $BackupPath" -ForegroundColor Red
  Write-Host ""
  Write-Host "  Uso: .\scripts\ops\restore-mongo-test.ps1 -BackupPath ""C:\ruta\al\dump\hrdb"""
  exit 1
}

# ── Validate MONGO_URI ──────────────────────────────────────────────
if (-not $env:MONGO_URI) {
  Write-Host "[ERROR] La variable de entorno MONGO_URI no esta definida." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Antes de restaurar, establece la variable:"
  Write-Host '    $env:MONGO_URI = "mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/hrdb"'
  exit 1
}

# ── Validate mongorestore ───────────────────────────────────────────
$mongorestorePath = Get-Command "mongorestore.exe" -ErrorAction SilentlyContinue
if (-not $mongorestorePath) {
  Write-Host "[ERROR] mongorestore.exe no encontrado." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Instala MongoDB Database Tools:"
  Write-Host "    https://www.mongodb.com/try/download/database-tools"
  Write-Host "  O via Chocolatey:"
  Write-Host "    choco install mongodb-database-tools"
  exit 1
}

# ── Security guards ─────────────────────────────────────────────────
$blocked = @("hrdb", "production", "prod", "admin")
$targetLower = $TargetDatabase.ToLower()

if ($blocked -contains $targetLower) {
  Write-Host "[SEGURIDAD] No se puede restaurar directamente sobre la base '$TargetDatabase'." -ForegroundColor Red
  Write-Host "  Este script solo restaura a bases de prueba."
  Write-Host "  Para restaurar a produccion, usa mongorestore manualmente con extrema precaucion."
  exit 1
}

if ($Drop -and (-not $TargetDatabase.EndsWith("_test"))) {
  Write-Host "[SEGURIDAD] La opcion -Drop solo esta permitida para bases que terminen en '_test'." -ForegroundColor Red
  Write-Host "  TargetDatabase actual: $TargetDatabase"
  exit 1
}

# ── Interactive confirmation ────────────────────────────────────────
Write-Host ""
Write-Host "========== CONFIRMACION REQUERIDA ==========" -ForegroundColor Yellow
Write-Host "  Backup origen  : $BackupPath"
Write-Host "  Base destino   : $TargetDatabase"
if ($Drop) {
  Write-Host "  Drop previo    : SI (la base se eliminara antes de restaurar)"
}
Write-Host ""
Write-Host "ADVERTENCIA: Esto modificara la base '$TargetDatabase'." -ForegroundColor Red
if ($Drop) {
  Write-Host "ADVERTENCIA: Con -Drop, TODOS los datos existentes en '$TargetDatabase' se perderan." -ForegroundColor Red
}
Write-Host ""
$confirmation = Read-Host "Escribi RESTORE (en mayusculas) para continuar"

if ($confirmation -ne "RESTORE") {
  Write-Host "Operacion cancelada." -ForegroundColor Yellow
  exit 0
}

# ── Build mongorestore arguments ────────────────────────────────────
$uri = $env:MONGO_URI
$argsList = @(
  "--uri", $uri,
  "--db", $TargetDatabase
)

if ($Drop) {
  $argsList += "--drop"
}

$argsList += $BackupPath

# ── Run mongorestore ────────────────────────────────────────────────
Write-Host ""
Write-Host "Restaurando backup..." -ForegroundColor Cyan

try {
  & $mongorestorePath.Source $argsList

  if ($LASTEXITCODE -ne 0) {
    throw "mongorestore falló con código $LASTEXITCODE"
  }
} catch {
  Write-Host "[ERROR] El restore falló: $_" -ForegroundColor Red
  exit 1
}

# ── Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========== RESTORE COMPLETADO ==========" -ForegroundColor Green
Write-Host "  Backup origen  : $BackupPath"
Write-Host "  Base destino   : $TargetDatabase"
if ($Drop) {
  Write-Host "  Drop previo    : SI"
} else {
  Write-Host "  Drop previo    : NO (los datos se agregan a los existentes)"
}
Write-Host ""
Write-Host "Para verificar:"
Write-Host "  mongosh ""$uri"" --eval ""use $TargetDatabase; db.getCollectionNames()""" -NoNewline
Write-Host ""
Write-Host ""
Write-Host "IMPORTANTE: '$TargetDatabase' es una base de prueba." -ForegroundColor Yellow
Write-Host "  No apuntes tu aplicacion a esta base en produccion." -ForegroundColor Yellow
