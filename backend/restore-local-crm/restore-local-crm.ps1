param(
  [string]$DumpPath = "$PSScriptRoot\database_dump_2026-09-08T02-32-04.json"
)

$ErrorActionPreference = "Stop"

$Backend = "C:\Projects\crm-project\backend"
$EnvFile = Join-Path $Backend ".env"
$NodeScript = Join-Path $PSScriptRoot "restore-local-crm.js"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " LOCAL CRM RESTORE - crm_db only" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if (!(Test-Path $Backend)) { throw "CRM backend not found: $Backend" }
if (!(Test-Path $EnvFile)) { throw ".env not found: $EnvFile" }
if (!(Test-Path $DumpPath)) { throw "Dump not found: $DumpPath" }
if (!(Test-Path $NodeScript)) { throw "Importer not found: $NodeScript" }

$envLine = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (!$envLine) { throw "DATABASE_URL not found in backend/.env" }

$dbUrl = ($envLine -replace '^\s*DATABASE_URL\s*=\s*','').Trim().Trim('"').Trim("'")
$uri = [System.Uri]$dbUrl
$dbName = $uri.AbsolutePath.TrimStart('/').Split('?')[0]

if ($uri.Host -notin @("localhost","127.0.0.1","::1")) {
  throw "STOP: DATABASE_URL is NOT local: $($uri.Host)"
}
if ($dbName -ne "crm_db") {
  throw "STOP: expected crm_db, actual database: $dbName"
}

Write-Host "Confirmed DB: $dbName @ $($uri.Host):$($uri.Port)" -ForegroundColor Green

# pg_dump does NOT understand Prisma's ?schema=public query parameter.
# Build a clean PostgreSQL connection URI without Prisma-specific query args.
$pgDbUrl = "$($uri.Scheme)://"
if ($uri.UserInfo) {
  $pgDbUrl += "$($uri.UserInfo)@"
}
$pgDbUrl += "$($uri.Host)"
if ($uri.Port -gt 0) {
  $pgDbUrl += ":$($uri.Port)"
}
$pgDbUrl += "/$dbName"

$backupDir = Join-Path $Backend "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $backupDir "crm_db_before_json_restore_$stamp.dump"

# Find pg_dump
$pgDump = $null
$cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($cmd) {
  $pgDump = $cmd.Source
} else {
  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin\pg_dump.exe" } |
    Where-Object { Test-Path $_ }
  if ($candidates) { $pgDump = $candidates | Select-Object -First 1 }
}

if ($pgDump) {
  Write-Host "Creating PostgreSQL backup..." -ForegroundColor Yellow
  & $pgDump "--dbname=$pgDbUrl" "--format=custom" "--file=$backup"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

  if (!(Test-Path $backup) -or ((Get-Item $backup).Length -le 0)) {
    throw "Backup file was not created or is empty."
  }

  $pgRestore = Join-Path (Split-Path $pgDump) "pg_restore.exe"
  if (Test-Path $pgRestore) {
    & $pgRestore "--list" "$backup" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_restore --list validation failed." }
  }

  Write-Host "Backup OK: $backup ($([math]::Round((Get-Item $backup).Length/1KB,1)) KB)" -ForegroundColor Green
} else {
  throw "pg_dump not found. Restore cancelled BEFORE any DB changes. Install PostgreSQL client tools or add pg_dump to PATH."
}

Push-Location $Backend
try {
  Write-Host ""
  Write-Host "Running Prisma importer..." -ForegroundColor Yellow
  node "$NodeScript" "$DumpPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Importer failed. Backup is safe at: $backup"
  }

  Write-Host ""
  Write-Host "Running Prisma validation..." -ForegroundColor Yellow
  cmd /c npx prisma validate
  if ($LASTEXITCODE -ne 0) { throw "prisma validate failed" }

  Write-Host ""
  Write-Host "============================================" -ForegroundColor Green
  Write-Host " SUCCESS" -ForegroundColor Green
  Write-Host " Local crm_db is now refreshed from JSON." -ForegroundColor Green
  Write-Host " Backup: $backup" -ForegroundColor Green
  Write-Host "============================================" -ForegroundColor Green
}
finally {
  Pop-Location
}
