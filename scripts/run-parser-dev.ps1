$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$parserDir = Join-Path $root "parser"
$venvPython = Join-Path $parserDir ".venv\Scripts\python.exe"
$serveScript = Join-Path $PSScriptRoot "serve-parser-dev.ps1"

if (-not (Test-Path -LiteralPath $venvPython)) {
  throw "No existe parser/.venv. Ejecutá npm run setup:parser"
}

Set-Location -LiteralPath "$root"

npx --yes nodemon --watch "$parserDir" --ext py --exec "powershell -ExecutionPolicy Bypass -File \"$serveScript\"" --cwd "$parserDir"
