<#
.SYNOPSIS
  Daily PostgreSQL backup with rotation (native Windows installation).

.DESCRIPTION
  Writes a custom-format pg_dump to <repo>\backups and deletes dumps older than
  -KeepDays. Reads the database password from DATABASE_URL in the root .env.
  Register it as a daily scheduled task with -Register (run once, as Administrator).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra\windows\backup.ps1 -Register
#>
param(
  [int]$KeepDays = 14,
  [string]$BackupDir = "",
  [switch]$Register
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $BackupDir) { $BackupDir = Join-Path $Root "backups" }

if ($Register) {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -KeepDays $KeepDays -BackupDir `"$BackupDir`""
  $trigger = New-ScheduledTaskTrigger -Daily -At "03:15"
  Register-ScheduledTask -TaskName "ShiftSmithBackup" -Action $action -Trigger $trigger `
    -User "SYSTEM" -RunLevel Highest -Force | Out-Null
  Write-Host "Scheduled task 'ShiftSmithBackup' registered (every day at 03:15)."
  exit 0
}

$line = Select-String -Path (Join-Path $Root ".env") -Pattern '^DATABASE_URL=(.+)$' | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL not found in .env" }
$url = [Uri]$line.Matches[0].Groups[1].Value.Trim()
$user, $password = $url.UserInfo.Split(":", 2)

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe not found in C:\Program Files\PostgreSQL" }

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$file = Join-Path $BackupDir ("planner-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

$env:PGPASSWORD = [Uri]::UnescapeDataString($password)
& $pgDump.FullName -h $url.Host -p $url.Port -U $user -d $url.AbsolutePath.TrimStart("/") -Fc -f "$file.tmp"
$code = $LASTEXITCODE
Remove-Item Env:PGPASSWORD
if ($code -ne 0) {
  Remove-Item "$file.tmp" -ErrorAction SilentlyContinue
  throw "pg_dump failed (exit $code)"
}
Move-Item "$file.tmp" $file

Get-ChildItem $BackupDir -Filter "planner-*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item

$size = [Math]::Round((Get-Item $file).Length / 1KB)
Write-Host "$(Get-Date -Format s) backup written: $file ($size KB)"
