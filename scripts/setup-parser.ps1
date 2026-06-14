$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$parserDir = Join-Path $root "parser"
$venvDir = Join-Path $parserDir ".venv"
$pythonExe = Join-Path $venvDir "Scripts\python.exe"

function Get-SystemPythonCommand() {
  if (Get-Command python -ErrorAction SilentlyContinue) {
    return "python"
  }

  if (Get-Command py -ErrorAction SilentlyContinue) {
    return "py"
  }

  throw "No se encontró Python en PATH. Instalá Python 3.10+ y asegurate de que `python` o `py` estén disponibles."
}

if (-not (Test-Path -LiteralPath $parserDir)) {
  throw "No existe el directorio parser"
}

if (-not (Test-Path -LiteralPath $venvDir)) {
  $pythonCommand = Get-SystemPythonCommand
  Write-Host "Creando entorno virtual del parser..."
  & $pythonCommand -m venv "$venvDir"
  if (-not $?) {
    throw "No se pudo crear el entorno virtual del parser"
  }
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "No se encontró parser/.venv/Scripts/python.exe"
}

Write-Host "Instalando dependencias del parser..."
& "$pythonExe" -m pip install -r (Join-Path $parserDir "requirements.txt")

if (-not $?) {
  throw "Falló la instalación de dependencias del parser"
}
