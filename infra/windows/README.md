# Native Windows Server installation (no Docker)

For a Windows server that already runs other services behind a reverse proxy such
as Caddy. The app listens on `127.0.0.1` only: PostgreSQL (5432), the solver
(`-SolverPort`, 8100 by default) and Next.js (`-AppPort`, 3100). The proxy
publishes it over HTTPS.

## Prerequisites (elevated PowerShell)

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e      # Node.js 24+
winget install --id Python.Python.3.13 -e
winget install --id NSSM.NSSM -e
```

PostgreSQL 18: EDB installer from <https://www.postgresql.org/download/windows/>
(keep port 5432, note the `postgres` superuser password, skip Stack Builder).
Open a **new** PowerShell afterwards so the `PATH` changes apply.

## Install

```powershell
git clone https://github.com/<you>/shift-smith.git C:\apps\shift-smith
cd C:\apps\shift-smith
powershell -ExecutionPolicy Bypass -File infra\windows\install.ps1 -Domain planning.example.com -Seed
```

The script (safe to re-run):

1. checks the prerequisites and that the ports are free;
2. creates the `planner` role and a **UTF-8** `planner` database (asks for the
   `postgres` password, never stores it);
3. writes the root `.env` (database URL, generated `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL`, `SOLVER_URL`); fill in `ADMIN_EMAIL`, `SMTP_*`, `LLM_*`,
   `APP_TIMEZONE` and `HOTEL_NAME` yourself, then `Restart-Service ShiftSmithWeb`;
4. installs, builds, migrates and (with `-Seed`) imports the demo data;
5. creates the solver venv (`services\solver\.venv`);
6. registers two auto-start services with NSSM: `ShiftSmithSolver` and
   `ShiftSmithWeb` (logs in `logs\`).

Then add the printed block to the Caddyfile and reload Caddy:

```
planning.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3100
}
```

## Operations

| Task | Command |
|---|---|
| Update | `powershell -ExecutionPolicy Bypass -File infra\windows\update.ps1` (`-Force` rebuilds the current commit) |
| Daily backup task (03:15) | `powershell -ExecutionPolicy Bypass -File infra\windows\backup.ps1 -Register` |
| Backup now | `powershell -ExecutionPolicy Bypass -File infra\windows\backup.ps1` |
| Status | `Get-Service ShiftSmith*` |
| Logs | `Get-Content logs\ShiftSmithWeb.log -Tail 50` |

`update.ps1` fetches `origin/main` (or `-Ref <sha>`), builds into
`apps\web\.next-build` while the site keeps serving `apps\web\.next`, applies the
migrations, then swaps the two builds and restarts `ShiftSmithWeb` (a few
seconds of downtime). When `pnpm-lock.yaml` changed, the site is stopped during the
install. If any step fails or the new version does not answer, it restores the
previous commit, dependencies and build, and restarts the services. Migrations are
not reverted, so keep them additive. A deployment job (for example a CI runner on
the server, in a private repository) can call it with `-Ref <sha>`.

Restore a dump (`backups\planner-*.dump`, custom format):

```powershell
Stop-Service ShiftSmithWeb
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h 127.0.0.1 -U planner -d planner --clean --if-exists --no-owner backups\planner-YYYYMMDD-HHMMSS.dump
Start-Service ShiftSmithWeb
```
