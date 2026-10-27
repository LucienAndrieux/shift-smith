<#
.SYNOPSIS
  Native Windows installation (no Docker): PostgreSQL database, .env, build,
  migrations, OR-Tools solver venv and two Windows services (NSSM).

.DESCRIPTION
  Prerequisites (see infra/windows/README.md): Git, Node.js 24, Python 3.13,
  PostgreSQL 18 and NSSM installed, repository cloned. Safe to run again: existing
  database, .env and services are kept and updated.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra\windows\install.ps1 -Domain planning.example.com -Seed
#>
param(
  [Parameter(Mandatory = $true)][string]$Domain,
  [int]$AppPort = 3100,
  [int]$SolverPort = 8100,
  [switch]$Seed
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Logs = Join-Path $Root "logs"
$EnvFile = Join-Path $Root ".env"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

function Require-Command($name, $hint) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { Fail "$name not found. $hint" }
  return $cmd.Source
}

# Native commands write progress to stderr; only the exit code matters.
function Run($file, [string[]]$arguments, $workdir = $Root) {
  Push-Location $workdir
  try {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) { Fail "'$file $($arguments -join ' ')' failed (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
}

function Write-Utf8NoBom($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function New-Secret([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return [Convert]::ToBase64String($buffer)
}

function Set-EnvValue([string]$text, [string]$key, [string]$value) {
  $line = "$key=$value"
  $pattern = "(?m)^$([regex]::Escape($key))=.*$"
  if ($text -match $pattern) { return [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator] { param($m) $line }) }
  return $text.TrimEnd() + "`n$line`n"
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Run this script from an elevated (Administrator) PowerShell."
}

# --------------------------------------------------------------------- prerequisites
Step "Checking prerequisites"
$node = Require-Command "node" "Install it with: winget install OpenJS.NodeJS.LTS"
$nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 24) { Fail "Node.js 24 or later is required (found $(& node --version))." }
Require-Command "git" "Install it with: winget install Git.Git" | Out-Null
$nssm = Require-Command "nssm" "Install it with: winget install NSSM.NSSM (then open a new PowerShell)."
# Recent npm versions block install scripts unless allowed, which leaves a broken
# pnpm shim; reinstall when `pnpm --version` does not answer.
$pnpmVersion = $null
if (Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue) { $pnpmVersion = & pnpm.cmd --version 2>$null }
if (-not $pnpmVersion) {
  Write-Host "Installing pnpm..."
  Run "npm.cmd" @("install", "-g", "pnpm@12.15.0", "--allow-scripts=pnpm")
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $pnpmVersion = & pnpm.cmd --version 2>$null
  if (-not $pnpmVersion) { Fail "pnpm does not start. Run: npm install -g pnpm@12.15.0 --allow-scripts=pnpm" }
}
$pnpm = Require-Command "pnpm.cmd" "npm install -g pnpm"
& py -3.13 --version 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Python 3.13 not found. Install it with: winget install Python.Python.3.13" }
$pgBin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgBin) { Fail "PostgreSQL not found in C:\Program Files\PostgreSQL. Install PostgreSQL 18 (see README)." }
$psql = $pgBin.FullName
$pgService = Get-Service | Where-Object { $_.Name -like "postgresql*" } | Select-Object -First 1
if (-not $pgService) { Fail "No PostgreSQL Windows service found." }
if ($pgService.Status -ne "Running") { Start-Service $pgService.Name }
Write-Host "Node $(& node --version), pnpm $pnpmVersion, PostgreSQL service $($pgService.Name)"

# Our own services are stopped first so their ports count as free on a re-run.
foreach ($name in @("ShiftSmithWeb", "ShiftSmithSolver")) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq "Running") { Stop-Service $name -Force }
}
foreach ($port in @($AppPort, $SolverPort)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
    Fail "Port $port is already used by another program. Choose another one with -AppPort / -SolverPort."
  }
}

# --------------------------------------------------------------------- database
Step "Database (role 'planner', database 'planner', UTF-8)"
$existingUrl = $null
if (Test-Path $EnvFile) {
  $match = Select-String -Path $EnvFile -Pattern '^DATABASE_URL=postgres://planner:([^@]+)@' | Select-Object -First 1
  if ($match -and $match.Matches[0].Groups[1].Value -ne "planner") { $existingUrl = $match }
}
if ($existingUrl) {
  $dbPassword = $existingUrl.Matches[0].Groups[1].Value
  Write-Host "Keeping the database password from .env"
} else {
  $dbPassword = (New-Secret 24) -replace '[^A-Za-z0-9]', ''
}
$superPassword = Read-Host "PostgreSQL superuser 'postgres' password (chosen during the PostgreSQL install)" -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($superPassword))
$roleExists = & $psql -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_roles WHERE rolname='planner'"
if ($LASTEXITCODE -ne 0) { Fail "Cannot connect to PostgreSQL as 'postgres' (wrong password?)." }
if ($roleExists -ne "1") {
  Run $psql @("-U", "postgres", "-h", "127.0.0.1", "-c", "CREATE ROLE planner LOGIN PASSWORD '$dbPassword'")
} else {
  Run $psql @("-U", "postgres", "-h", "127.0.0.1", "-c", "ALTER ROLE planner PASSWORD '$dbPassword'")
}
$dbExists = & $psql -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname='planner'"
if ($dbExists -ne "1") {
  # Windows clusters default to WIN1252; the app stores characters that need UTF-8.
  Run $psql @("-U", "postgres", "-h", "127.0.0.1", "-c", "CREATE DATABASE planner OWNER planner ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0")
}
$encoding = & $psql -U postgres -h 127.0.0.1 -tAc "SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname='planner'"
if ($encoding -ne "UTF8") { Fail "Database 'planner' exists with encoding $encoding; it must be UTF8." }
Remove-Item Env:PGPASSWORD

# --------------------------------------------------------------------- .env
Step "Configuration file .env"
if (Test-Path $EnvFile) { $envText = Get-Content $EnvFile -Raw -Encoding UTF8 } else { $envText = Get-Content (Join-Path $Root ".env.example") -Raw -Encoding UTF8 }
$envText = Set-EnvValue $envText "DATABASE_URL" "postgres://planner:$dbPassword@127.0.0.1:5432/planner"
$envText = Set-EnvValue $envText "BETTER_AUTH_URL" "https://$Domain"
$envText = Set-EnvValue $envText "APP_DOMAIN" $Domain
$envText = Set-EnvValue $envText "SOLVER_URL" "http://127.0.0.1:$SolverPort"
if ($envText -match '(?m)^BETTER_AUTH_SECRET=(change-me.*)?$') {
  $envText = Set-EnvValue $envText "BETTER_AUTH_SECRET" (New-Secret 32)
}
Write-Utf8NoBom $EnvFile $envText
Write-Host ".env written. Fill in SMTP_* and LLM_* in $EnvFile if not done yet."

# --------------------------------------------------------------------- web app
Step "Installing dependencies and building the web app (several minutes)"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
Run $pnpm @("install", "--frozen-lockfile")
Run $pnpm @("build")
Run $pnpm @("db:migrate")
if ($Seed) { Run $pnpm @("db:seed") }

# --------------------------------------------------------------------- solver
Step "Solver (Python venv + OR-Tools)"
$solverDir = Join-Path $Root "services\solver"
$venvPython = Join-Path $solverDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) { Run "py" @("-3.13", "-m", "venv", ".venv") $solverDir }
Run $venvPython @("-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", "requirements.txt") $solverDir

# --------------------------------------------------------------------- services
function Install-Service($name, $exe, $arguments, $directory, $description, [string[]]$extraEnv, [string[]]$dependsOn) {
  if (-not (Get-Service -Name $name -ErrorAction SilentlyContinue)) {
    Run $nssm @("install", $name, $exe)
  } else {
    Run $nssm @("set", $name, "Application", $exe)
  }
  Run $nssm @("set", $name, "AppParameters", $arguments)
  Run $nssm @("set", $name, "AppDirectory", $directory)
  Run $nssm @("set", $name, "Description", $description)
  Run $nssm @("set", $name, "Start", "SERVICE_AUTO_START")
  Run $nssm @("set", $name, "AppStdout", (Join-Path $Logs "$name.log"))
  Run $nssm @("set", $name, "AppStderr", (Join-Path $Logs "$name.log"))
  Run $nssm @("set", $name, "AppRotateFiles", "1")
  Run $nssm @("set", $name, "AppRotateBytes", "10485760")
  Run $nssm @("set", $name, "AppExit", "Default", "Restart")
  if ($extraEnv) { Run $nssm (@("set", $name, "AppEnvironmentExtra") + $extraEnv) }
  if ($dependsOn) { Run $nssm (@("set", $name, "DependOnService") + $dependsOn) }
}

Step "Windows services ShiftSmithSolver and ShiftSmithWeb"
Install-Service "ShiftSmithSolver" $venvPython "-m uvicorn app.main:app --host 127.0.0.1 --port $SolverPort" $solverDir `
  "ShiftSmith - OR-Tools solver" @() @()
$nextBin = Join-Path $Root "apps\web\node_modules\next\dist\bin\next"
Install-Service "ShiftSmithWeb" $node "`"$nextBin`" start -H 127.0.0.1 -p $AppPort" (Join-Path $Root "apps\web") `
  "ShiftSmith - web app" @("NODE_ENV=production", "NEXT_TELEMETRY_DISABLED=1") @($pgService.Name, "ShiftSmithSolver")

Start-Service ShiftSmithSolver
Start-Service ShiftSmithWeb
Start-Sleep -Seconds 8

Step "Health checks"
try {
  $health = Invoke-RestMethod "http://127.0.0.1:$SolverPort/health" -TimeoutSec 20
  Write-Host "Solver: $($health.status)"
} catch { Write-Host "Solver not answering yet: see $Logs\ShiftSmithSolver.log" -ForegroundColor Yellow }
try {
  $page = Invoke-WebRequest "http://127.0.0.1:$AppPort/sign-in" -UseBasicParsing -TimeoutSec 60
  Write-Host "Web app: HTTP $($page.StatusCode)"
} catch { Write-Host "Web app not answering yet: see $Logs\ShiftSmithWeb.log" -ForegroundColor Yellow }

Write-Host @"

Done. Add this block to your Caddyfile, then reload Caddy:

$Domain {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$AppPort
}
"@ -ForegroundColor Green
