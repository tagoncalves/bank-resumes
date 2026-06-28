$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"

if (-not (Test-Path -LiteralPath $webDir)) {
  throw "No existe el directorio web"
}

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./prisma/dev.db" }
$env:PARSER_SERVICE_URL = if ($env:PARSER_SERVICE_URL) { $env:PARSER_SERVICE_URL } else { "http://localhost:8002" }

npm --prefix "$webDir" run start
