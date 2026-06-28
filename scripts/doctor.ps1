$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $root "web"
$parserDir = Join-Path $root "parser"
$venvPython = Join-Path $parserDir ".venv\Scripts\python.exe"
$webNodeModules = Join-Path $webDir "node_modules"

$issues = New-Object System.Collections.Generic.List[string]

$minNodeMajor = 18
$minPythonMajor = 3
$minPythonMinor = 10

function Test-CommandAvailable([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Test-CommandRuns([string]$name, [string]$arg) {
  try {
    $output = & $name $arg 2>&1
    if (-not $?) {
      return $null
    }

    return ($output | Out-String).Trim()
  } catch {
    return $null
  }
}

function Test-TcpPort([int]$port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(500)
    if (-not $ok) {
      $client.Close()
      return $false
    }

    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Get-NodeMajorVersion([string]$versionText) {
  if ($versionText -match "v(\d+)") {
    return [int]$matches[1]
  }

  return $null
}

function Get-PythonVersionParts([string]$versionText) {
  if ($versionText -match "Python\s+(\d+)\.(\d+)") {
    return @{ Major = [int]$matches[1]; Minor = [int]$matches[2] }
  }

  return $null
}

Write-Host "== Bank Resumes Doctor =="
Write-Host ""

Write-Host "Repo: $root"
Write-Host ""

if (Test-Path -LiteralPath $webDir) {
  Write-Host "[OK] Directorio web presente"
} else {
  Write-Host "[FAIL] Falta directorio web"
  $issues.Add("Falta el directorio web")
}

if (Test-Path -LiteralPath $parserDir) {
  Write-Host "[OK] Directorio parser presente"
} else {
  Write-Host "[FAIL] Falta directorio parser"
  $issues.Add("Falta el directorio parser")
}

if (Test-CommandAvailable "node") {
  $nodeVersion = (& node --version).Trim()
  $nodeMajor = Get-NodeMajorVersion $nodeVersion
  if ($nodeMajor -ge $minNodeMajor) {
    Write-Host "[OK] Node disponible: $nodeVersion"
  } else {
    Write-Host "[FAIL] Node insuficiente: $nodeVersion"
    $issues.Add("Actualizar Node.js a $minNodeMajor+ (actual: $nodeVersion)")
  }
} else {
  Write-Host "[FAIL] Node no está disponible en PATH"
  $issues.Add("Instalar Node.js y agregarlo a PATH")
}

if (Test-CommandAvailable "npm") {
  Write-Host "[OK] npm disponible: $(& npm --version)"
} else {
  Write-Host "[FAIL] npm no está disponible en PATH"
  $issues.Add("Instalar npm y agregarlo a PATH")
}

if (Test-CommandAvailable "python") {
  $pythonVersion = Test-CommandRuns "python" "--version"
  if ($pythonVersion) {
    $pythonParts = Get-PythonVersionParts $pythonVersion
    if ($pythonParts -and ($pythonParts.Major -gt $minPythonMajor -or ($pythonParts.Major -eq $minPythonMajor -and $pythonParts.Minor -ge $minPythonMinor))) {
      Write-Host "[OK] Python disponible: $pythonVersion"
    } else {
      Write-Host "[FAIL] Python insuficiente: $pythonVersion"
      $issues.Add("Actualizar Python a $minPythonMajor.$minPythonMinor+ (actual: $pythonVersion)")
    }
  } elseif (Test-CommandAvailable "py") {
    $pyVersion = Test-CommandRuns "py" "--version"
    if ($pyVersion) {
      $pythonParts = Get-PythonVersionParts $pyVersion
      if ($pythonParts -and ($pythonParts.Major -gt $minPythonMajor -or ($pythonParts.Major -eq $minPythonMajor -and $pythonParts.Minor -ge $minPythonMinor))) {
        Write-Host "[OK] Python launcher disponible: $pyVersion"
      } else {
        Write-Host "[FAIL] Python insuficiente: $pyVersion"
        $issues.Add("Actualizar Python a $minPythonMajor.$minPythonMinor+ (actual: $pyVersion)")
      }
    } else {
      Write-Host "[FAIL] Python no está disponible en PATH"
      $issues.Add("Instalar Python 3.10+ y exponer `python` o `py` en PATH")
    }
  } else {
    Write-Host "[FAIL] Python no está disponible en PATH"
    $issues.Add("Instalar Python 3.10+ y exponer `python` o `py` en PATH")
  }
} elseif (Test-CommandAvailable "py") {
  $pyVersion = Test-CommandRuns "py" "--version"
  if ($pyVersion) {
    $pythonParts = Get-PythonVersionParts $pyVersion
    if ($pythonParts -and ($pythonParts.Major -gt $minPythonMajor -or ($pythonParts.Major -eq $minPythonMajor -and $pythonParts.Minor -ge $minPythonMinor))) {
      Write-Host "[OK] Python launcher disponible: $pyVersion"
    } else {
      Write-Host "[FAIL] Python insuficiente: $pyVersion"
      $issues.Add("Actualizar Python a $minPythonMajor.$minPythonMinor+ (actual: $pyVersion)")
    }
  } else {
    Write-Host "[FAIL] Python no está disponible en PATH"
    $issues.Add("Instalar Python 3.10+ y exponer `python` o `py` en PATH")
  }
} else {
  Write-Host "[FAIL] Python no está disponible en PATH"
  $issues.Add("Instalar Python 3.10+ y exponer `python` o `py` en PATH")
}

if (Test-Path -LiteralPath $venvPython) {
  Write-Host "[OK] Virtualenv del parser presente"
} else {
  Write-Host "[WARN] No existe parser/.venv"
  $issues.Add("Ejecutar npm run setup:parser")
}

if (Test-Path -LiteralPath $webNodeModules) {
  Write-Host "[OK] Dependencias web instaladas"
} else {
  Write-Host "[WARN] Faltan dependencias en web/node_modules"
  $issues.Add("Ejecutar npm run setup:web")
}

if ($env:JWT_SECRET) {
  Write-Host "[OK] JWT_SECRET definido en la sesión"
} else {
  Write-Host "[WARN] JWT_SECRET no está definido en la sesión actual"
}

if ($env:DATABASE_URL) {
  Write-Host "[OK] DATABASE_URL definido: $($env:DATABASE_URL)"
} else {
  Write-Host "[INFO] DATABASE_URL no está definido. Se usará el default local en los scripts raíz"
}

if ($env:PARSER_SERVICE_URL) {
  Write-Host "[OK] PARSER_SERVICE_URL definido: $($env:PARSER_SERVICE_URL)"
} else {
  Write-Host "[INFO] PARSER_SERVICE_URL no está definido. Se usará http://localhost:8002"
}

if (Test-TcpPort 3000) {
  Write-Host "[WARN] El puerto 3000 ya está en uso"
  $issues.Add("Liberar el puerto 3000 o cambiar el puerto de la web")
} else {
  Write-Host "[OK] Puerto 3000 disponible"
}

if (Test-TcpPort 8002) {
  Write-Host "[WARN] El puerto 8002 ya está en uso"
  $issues.Add("Liberar el puerto 8002 o cambiar el puerto del parser")
} else {
  Write-Host "[OK] Puerto 8002 disponible"
}

Write-Host ""

if ($issues.Count -eq 0) {
  Write-Host "Diagnóstico: OK"
  exit 0
}

Write-Host "Diagnóstico: hay acciones pendientes"
foreach ($issue in $issues) {
  Write-Host "- $issue"
}

exit 1
