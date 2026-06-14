$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "setup-parser.ps1")
& (Join-Path $PSScriptRoot "setup-web.ps1")

Write-Host "Setup completo."
