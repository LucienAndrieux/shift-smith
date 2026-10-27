# ShiftSmith

Self-hosted web app for the monthly staff schedules of a small hotel (about 25–30
employees in six sections): month and week views, scheduling rules and validation,
an hour bank, one-click repairs, full-month generation with OR-Tools,
natural-language constraints and admin approval of accounts.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui ·
PostgreSQL 18 · Drizzle ORM · Better Auth · pg-boss · any OpenAI-compatible LLM · Python FastAPI +
OR-Tools CP-SAT · Vitest · Biome · Docker Compose + Caddy.

```
apps/web                  Next.js app (UI, Server Actions, jobs, domain logic)
apps/web/src/lib/domain   Pure TypeScript: durations, day codes, hour bank, validator, repairs
services/solver           OR-Tools CP-SAT schedule generator (FastAPI)
docs/seed-data.json       Fictional demo data (single source of truth for the seed)
infra                     Production compose file, Caddyfile, backup script
infra/windows             Native Windows Server install, update and backup scripts
```

## Demo data

Every person, hotel, place, employee number, birthday, leave period and schedule
in `docs/seed-data.json` is **fictional**. The demo hotel is "Demo Alpine Lodge", an
invented mountain hotel in an invented French Alps village; public holidays are
generated for France and the demo months are November 2026 to January 2027.

The November 2026 reference schedule is produced by
`scripts/generate-demo-schedule.ts`: it builds a schedule that respects the rules,
then adds a handful of deliberate mistakes (a birthday worked, a late shift followed
by an early one, a rest day worked, a couple without a shared rest day, a
short-staffed restaurant, two colleagues off the same weekend, a shift outside an
employee's skills) so the validator and the "Fix" button have something to show.

## Public demo mode

With `DEMO_MODE=true`, the app becomes a public demo:

- the sign-in page offers **Explore as a manager** and **Explore read-only**: a
  guest account is created on the fly (Better Auth anonymous plugin), no sign-up;
- a guest manager duplicates a version or generates a month to get **private
  drafts**, edits them, uses Fix, Generate, the PDF export and natural-language
  constraints (approving one applies its absences and forced shifts to the
  guest's own draft); reference data, publishing, the hour-bank close and user
  management stay admin-only, checked server-side in every action;
- quotas: drafts per guest, generations per hour (one at a time on the whole
  site) and LLM calls per guest and per day (`DEMO_*` variables);
- an hourly job removes guests older than 24 hours with their work, and when the
  current month has no published schedule it empties the data and imports the seed
  again with **rolling demo months** (the current month and the next two), each
  with a freshly generated published schedule; the current month contains the
  deliberate mistakes;
- only `ADMIN_EMAIL` addresses can register (for the site owner).

## Development

Prerequisites: **Node.js 24+**, **pnpm** (`npm i -g pnpm`), **Docker Desktop**.

```bash
cp .env.example .env
```

Edit `.env`: set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAIL`
and, to parse natural-language constraints, `LLM_API_KEY` / `LLM_BASE_URL` /
`LLM_MODEL` (OpenAI, Groq or any OpenAI-compatible API with structured outputs).

```bash
docker compose up -d --build
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open <http://localhost:3000> and register with an address listed in `ADMIN_EMAIL`:
that account is created as an approved admin. Any other registration is a pending
viewer; the access-request email is printed in the `pnpm dev` console when
`SMTP_HOST` is empty.

| Command | Description |
|---|---|
| `pnpm dev` | Dev server on :3000 (also starts the pg-boss worker) |
| `pnpm check` | Typecheck + Biome lint + Vitest |
| `pnpm format` | Biome format and safe fixes |
| `pnpm db:generate` | New SQL migration from the Drizzle schema (`apps/web/drizzle/`) |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent import of `docs/seed-data.json`, then a validator report for the reference month |
| `pnpm db:generate-demo` | Regenerate the demo reference schedule inside `docs/seed-data.json` |
| `pnpm db:reset` | Drop every table of the **local** database (refuses any non-local host) |
| `pnpm db:studio` | Drizzle Studio |

The seed only inserts rows that are missing (matched on natural keys), so it never
overwrites changes made in the app. To start from scratch:
`pnpm db:reset && pnpm db:migrate && pnpm db:seed`.

## Day codes

A day is either a shift (codes A–E, per section) or one of these codes:

| Code | Label | Kind | Due day | Credits time |
|---|---|---|---|---|
| OF | Day off (weekly rest) | rest | no | no |
| PH | Public holiday | absence | yes | yes |
| AL | Annual leave | absence | yes | yes |
| SL | Sick leave | absence | yes | yes |
| BD | Birthday leave | absence | yes | yes |
| TL | Time off in lieu | absence | yes | no |
| TR | Training | absence | yes | yes |
| OL | Other paid leave | absence | yes | yes |
| UL | Unpaid leave | absence | no | no |

## Deployment (Linux VPS)

Requirements: Docker Engine with the compose plugin, a DNS record pointing
`APP_DOMAIN` to the server, ports 80 and 443 open.

```bash
git clone <repo> /opt/shift-smith && cd /opt/shift-smith
cp .env.example .env
```

In `.env`, set at least `APP_DOMAIN` (e.g. `planning.example.com`),
`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, the `SMTP_*` values, the
`LLM_*` variables, `APP_TIMEZONE` and `HOTEL_NAME`. `DATABASE_URL` and
`BETTER_AUTH_URL` are derived by the compose file.

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file .env exec web node scripts/seed.mjs
```

- `postgres` is not published on the host; data lives in the `pgdata` volume.
- `web` applies pending migrations at every start, then serves Next.js
  (standalone build) and runs the background job worker.
- `caddy` obtains and renews the HTTPS certificate for `APP_DOMAIN` automatically.

Update: `git pull && docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build`.

## Deployment (Windows Server, no Docker)

See [infra/windows/README.md](infra/windows/README.md): PostgreSQL, Node.js and
the Python solver run as Windows services behind an existing reverse proxy.

## Backup & restore

`infra/backup.sh` writes a gzipped `pg_dump` to `./backups` and deletes dumps older
than `KEEP_DAYS` (14 by default). Install it as a daily cron job:

```bash
chmod +x infra/backup.sh
( crontab -l; echo "15 3 * * * /opt/shift-smith/infra/backup.sh >> /var/log/planner-backup.log 2>&1" ) | crontab -
```

Copy `backups/` off the server regularly (e.g. `rclone` or `rsync`). Backups are
ignored by git and must never be committed.

Restore a dump (the dump contains `DROP … IF EXISTS`, so it replaces the current data):

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env stop web
gunzip -c backups/planner-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose -f infra/docker-compose.prod.yml --env-file .env exec -T postgres psql -U planner -d planner
docker compose -f infra/docker-compose.prod.yml --env-file .env start web
```

## Key behaviours

- **Access:** registration → pending viewer + email to `ADMIN_EMAIL`; admins approve
  or reject in `/admin/users`. Viewers are read-only and only see published
  versions; every mutation is checked server-side and written to `audit_log`.
- **Validation:** `lib/domain/validator.ts` checks every hard rule (rest time across
  midnight, consecutive days, two rest days per ISO week, monthly weekend off,
  birthday, couples, approved leave, eligibility, unavailability, staffing) and
  computes hours per employee and ISO week.
- **Hour bank:** expected = daily contract (weekly ÷ 5) × (days with a shift + days
  whose code is due); credited = daily contract × days whose code credits time;
  delta = worked + credited − expected. TL is due but credits nothing, so it is
  paid from the bank. Closing a month writes one `monthly_close` entry per employee
  with a complete month.
- **Fix:** each error offers up to five local repairs, each replayed through the
  validator and kept only when it adds no new error.
- **Generation:** for months after the current one, "Generate" asks the OR-Tools
  solver for a complete schedule (hard rules enforced, staffing and preferences
  optimised) and saves it as a new draft to review and publish.
- **Constraints:** free text → pg-boss job → LLM with JSON-schema structured outputs → review card →
  admin approval materialises the operations (`source = constraint`).
- **Printable monthly sheet:** PDF export of a version, per section or for the
  whole hotel.

## License

[MIT](LICENSE)
