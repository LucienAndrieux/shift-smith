<#
.SYNOPSIS
  Updates a native Windows installation with a short downtime and an automatic
  rollback: the new version is built next to the live one, then swapped in.

.DESCRIPTION
  1. fetch and fast-forward to -Ref (default origin/main);
  2. install dependencies (only when the lockfile changed: this stops the site);
  3. build into apps\web\.next-build while the site keeps serving apps\web\.next;
  4. apply database migrations, update the solver when it changed;
  5. swap the builds, restart ShiftSmithWeb and check that it answers.
  If any step fails, the code, dependencies and previous build are restored and the
  services restarted, so the site keeps running the previous version. Migrations
  are not reverted (they are written to be additive).
  Can be run by hand or from a deployment job on the server.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra\windows\update.ps1
#>
param(
  [string]$Ref = "origin/main",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Web = Join-Path $Root "apps\web"
$SolverDir = Join-Path $Root "services\solver"
$Live = Join-Path $Web ".next"
$Next = Join-Path $Web ".next-build"
$Previous = Join-Path $Web ".next-previous"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

# Native commands write progress to stderr; only the exit code matters.
function Run($file, [string[]]$arguments, $workdir = $Root) {
  Push-Location $workdir
  try {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) { throw "'$file $($arguments -join ' ')' failed (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
}

function Invoke-Git([string[]]$arguments) {
  $output = & git -C $Root @arguments
  if ($LASTEXITCODE -ne 0) { throw "git $($arguments -join ' ') failed (exit $LASTEXITCODE)." }
  return $output
}

function Wait-Http($url, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
      if ($response.StatusCode -eq 200) { return $true }
    } catch { }
    Start-Sleep -Seconds 2
  }
  return $false
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script as an Administrator."
}

$pnpm = (Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue).Source
if (-not $pnpm) { $pnpm = Join-Path $env:APPDATA "npm\pnpm.cmd" }
if (-not (Test-Path $pnpm)) { throw "pnpm not found (run infra\windows\install.ps1 first)." }

# The port comes from the service definition written by install.ps1 (NSSM).
$appPort = 3100
$parameters = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\ShiftSmithWeb\Parameters" -ErrorAction SilentlyContinue).AppParameters
if ($parameters -match '-p (\d+)') { $appPort = [int]$Matches[1] }
$healthUrl = "http://127.0.0.1:$appPort/sign-in"

Step "Fetching $Ref"
Invoke-Git @("fetch", "--quiet", "origin") | Out-Null
$old = (Invoke-Git @("rev-parse", "HEAD")).Trim()
$new = (Invoke-Git @("rev-parse", "$Ref^{commit}")).Trim()
if ($old -eq $new -and -not $Force -and (Test-Path $Live)) {
  Write-Host "Already at $($new.Substring(0, 7)); nothing to deploy (use -Force to rebuild)."
  exit 0
}
$changed = @()
if ($old -ne $new) { $changed = @(Invoke-Git @("diff", "--name-only", $old, $new)) }
$lockChanged = ($changed -contains "pnpm-lock.yaml") -or -not (Test-Path (Join-Path $Root "node_modules"))
$requirementsChanged = $changed -contains "services/solver/requirements.txt"
$solverChanged = @($changed | Where-Object { $_ -like "services/solver/*" }).Count -gt 0
Write-Host "Deploying $($old.Substring(0, 7)) -> $($new.Substring(0, 7)) ($($changed.Count) files changed)"

$state = @{ moved = $false; webStopped = $false; swapped = $false }
try {
  Invoke-Git @("merge", "--ff-only", "--quiet", $new) | Out-Null
  $state.moved = $true

  if ($lockChanged) {
    # Packages in use cannot be replaced on Windows: the site is down until the swap.
    Step "Dependencies changed: stopping the site and installing"
    Stop-Service ShiftSmithWeb -Force
    $state.webStopped = $true
    Run $pnpm @("install", "--frozen-lockfile")
  }

  Step "Building the new version (the site stays online)"
  if (Test-Path $Next) { Remove-Item $Next -Recurse -Force }
  $env:NEXT_DIST_DIR = ".next-build"
  try { Run $pnpm @("build") } finally { Remove-Item Env:NEXT_DIST_DIR }

  Step "Database migrations"
  Run $pnpm @("db:migrate")

  if ($solverChanged) {
    Step "Updating the solver"
    Stop-Service ShiftSmithSolver -Force
    if ($requirementsChanged) {
      Run (Join-Path $SolverDir ".venv\Scripts\python.exe") @("-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", "requirements.txt") $SolverDir
    }
    Start-Service ShiftSmithSolver
  }

  Step "Switching to the new version"
  Stop-Service ShiftSmithWeb -Force
  $state.webStopped = $true
  if (Test-Path $Previous) { Remove-Item $Previous -Recurse -Force }
  if (Test-Path $Live) { Rename-Item $Live ".next-previous" }
  Rename-Item $Next ".next"
  $state.swapped = $true
  Start-Service ShiftSmithWeb
  $state.webStopped = $false
  if (-not (Wait-Http $healthUrl 90)) { throw "The new version does not answer on $healthUrl (see logs\ShiftSmithWeb.log)." }

  Write-Host "`nDeployed $($new.Substring(0, 7))." -ForegroundColor Green
} catch {
  $failure = $_.Exception.Message
  Write-Host "`nDEPLOY FAILED: $failure" -ForegroundColor Red
  Write-Host "Rolling back to $($old.Substring(0, 7))..." -ForegroundColor Yellow
  try {
    if ($state.moved) { Invoke-Git @("reset", "--hard", "--quiet", $old) | Out-Null }
    if ($state.swapped -or $state.webStopped) { Stop-Service ShiftSmithWeb -Force }
    if ($state.moved -and $lockChanged) { Run $pnpm @("install", "--frozen-lockfile") }
    if ($state.swapped -and (Test-Path $Previous)) {
      Remove-Item $Live -Recurse -Force
      Rename-Item $Previous ".next"
    }
    if ($solverChanged) { Restart-Service ShiftSmithSolver -Force }
    Start-Service ShiftSmithWeb
    if (Wait-Http $healthUrl 90) {
      Write-Host "Rollback done: the site runs $($old.Substring(0, 7)) again." -ForegroundColor Yellow
    } else {
      Write-Host "Rollback done but the site does not answer: see logs\ShiftSmithWeb.log." -ForegroundColor Red
    }
  } catch {
    Write-Host "Rollback failed: $($_.Exception.Message)" -ForegroundColor Red
  }
  exit 1
}
