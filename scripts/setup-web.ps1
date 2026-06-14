$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"

if (-not (Test-Path -LiteralPath $webDir)) {
  throw "No existe el directorio web"
}

Write-Host "Instalando dependencias de la web..."
npm --prefix "$webDir" install

if (-not $?) {
  throw "Falló la instalación de dependencias de la web"
}

$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:./prisma/dev.db" }

Write-Host "Sincronizando base de datos..."
npm --prefix "$webDir" run db:push

if (-not $?) {
  throw "Falló prisma db push"
}

Write-Host "Cargando datos base..."
npm --prefix "$webDir" run db:seed

if (-not $?) {
  throw "Falló prisma db seed"
}
