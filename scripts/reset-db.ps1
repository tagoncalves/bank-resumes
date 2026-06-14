$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"
$dbDir = Join-Path $webDir "prisma"
$dbPath = Join-Path $dbDir "dev.db"
$dbJournalPath = Join-Path $dbDir "dev.db-journal"

if (-not (Test-Path -LiteralPath $webDir)) {
  throw "No existe el directorio web"
}

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./prisma/dev.db" }

if (Test-Path -LiteralPath $dbPath) {
  Remove-Item -LiteralPath "$dbPath" -Force
}

if (Test-Path -LiteralPath $dbJournalPath) {
  Remove-Item -LiteralPath "$dbJournalPath" -Force
}

Write-Host "Base local reiniciada."

npm --prefix "$webDir" run db:push

if (-not $?) {
  throw "Falló prisma db push"
}

npm --prefix "$webDir" run db:seed

if (-not $?) {
  throw "Falló prisma db seed"
}
