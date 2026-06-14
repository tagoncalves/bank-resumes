$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$parserDir = Join-Path $root "parser"
$venvPython = Join-Path $parserDir ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
  throw "No existe parser/.venv. Ejecutá npm run setup:parser"
}

& "$venvPython" -m uvicorn main:app --host 0.0.0.0 --port 8001
