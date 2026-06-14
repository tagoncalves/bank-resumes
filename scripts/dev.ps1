$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./prisma/dev.db" }
$env:PARSER_SERVICE_URL = if ($env:PARSER_SERVICE_URL) { $env:PARSER_SERVICE_URL } else { "http://localhost:8001" }

& (Join-Path $PSScriptRoot "setup.ps1")

npx --yes concurrently -k -s first -n parser,web -c yellow,cyan `
  "npm run dev:parser" `
  "powershell -ExecutionPolicy Bypass -Command \"npx --yes wait-on http://localhost:8001/health; if (`$?) { npm run dev:web }\""
