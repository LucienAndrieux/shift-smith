# ShiftSmith — staff scheduling app

Self-hosted web app managing the monthly staff schedules of a small hotel
(~28 employees, 6 sections). The OR-Tools CP-SAT solver lives in
`services/solver` (Python/FastAPI) and generates drafts for future months.
All seed data is fictional (`docs/seed-data.json`, demo hotel "Demo Alpine Lodge").

## Conventions

- **Everything in English** (UI, code, DB, docs). Day codes are OF, PH, AL, SL, BD,
  TL, TR, OL, UL (`src/lib/domain/day-codes.ts`); shift codes are A–E per section.
  Keep accents in names.
- Time zone from `APP_TIMEZONE` (default `Europe/Paris`); ISO weeks (Mon → Sun).
  Dates are `YYYY-MM-DD` strings in domain code; times of day are minutes from
  midnight (0–1440).
- Domain logic lives in `apps/web/src/lib/domain/`: pure TypeScript, no framework or
  DB imports, covered by Vitest. The validator there also checks solver output.
- Zod schemas are shared between server and client (`src/lib/schemas/`).
- Every admin mutation: Server Action → `requireAdmin()` → DB write → `audit()`.
  Reads go through `requireApprovedUser()`. Never rely on hidden buttons alone.
- Never store the reason for a reduced schedule. Never store passwords in seeds.
  Never commit real personal data: the seed and every fixture stay fictional.
- Fields marked `to_confirm` in seed data are imported with `to_confirm = true` and
  shown with a badge in the UI.

## Commands (from the repo root)

| Command | What it does |
|---|---|
| `docker compose up -d --build` | Start local Postgres and the solver (:8000) |
| `pnpm install` | Install deps |
| `pnpm db:generate` | Generate a SQL migration from the Drizzle schema |
| `pnpm db:reset` | Drop every table of the local database (refuses non-local hosts) |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent import of `docs/seed-data.json` + validator report |
| `pnpm db:generate-demo` | Regenerate the November 2026 demo schedule in the seed file |
| `pnpm dev` | Next.js dev server on :3000 |
| `pnpm check` | Typecheck + Biome lint + Vitest — must pass before committing |
| `pnpm --filter web build:scripts` | Bundle migrate/seed into `dist-scripts/*.mjs` (used by the Docker image) |

## Stack notes / decisions

- Next.js 16 with `cacheComponents` + `partialPrefetching` on. Request-time reads
  (session, DB) must sit behind `<Suspense>` (use `loading.tsx` or explicit
  boundaries). Next's bundled docs: `apps/web/node_modules/next/dist/docs/`.
- `(app)/layout.tsx` sets `instant = false`: every route reads the session, so the
  dev "instant navigation" insights about uncached data are expected noise.
- Server Actions: `adminAction(schema, handler)` in `src/server/action.ts` (auth +
  Zod + `refresh()`); forms use `useZodForm` / `FormDialog`, which send the raw
  schema *input* so the action re-validates the same shape.
- TanStack Table is v9: use `DataTable` / `AppColumnDef` from
  `src/components/data-table.tsx` (feature registry, `sortFn` not `sortingFn`).
- When testing in the in-app browser with the pane hidden, streamed Suspense
  content is not revealed (no animation frames); read the server HTML instead.
- `proxy.ts` (formerly middleware) only does optimistic cookie redirects; real
  checks happen in the data access layer.
- Biome for lint + format (shadcn files in `src/components/ui` are not linted).
- The single `.env` lives at the repo root; `next.config.ts` and
  `scripts/load-env.ts` load it.
- `ADMIN_EMAIL` is a comma-separated list (env only): registering with one of those
  emails creates an approved admin; all receive "new access request" emails.

## Layout

- `src/lib/domain/` — pure logic + tests (`__fixtures__/seed.ts` loads the demo seed).
- `src/lib/schemas/` — shared Zod schemas (form input = strings, output = DB values).
- `src/lib/constraints/` — LLM operation schema, human descriptions, post-checks.
- `src/server/` — DB-facing code: `session.ts` (auth helpers), `action.ts`,
  `audit.ts`, `email.ts`, `month-context.ts` (loads a month for the validator),
  `queries/*`, `constraints/*` (parse + apply), `jobs/*` (pg-boss).
- `src/app/(app)/<route>/actions.ts` — Server Actions per screen.
- `scripts/` — `migrate.ts`, `reset.ts`, `seed.ts`, `generate-demo-schedule.ts`,
  `schedule-file.ts` (export/import a month between databases), `load-env.ts`.

## Decisions

- Day codes carry two flags: `is_due_day` (counts in the time owed) and
  `credits_time` (credited with the daily contract). Hour bank: expected = daily ×
  (shift days + due days), credited = daily × crediting days, delta = worked +
  credited − expected. OF and UL are neither; TL is due but credits nothing.
- Fixed days off are two weekdays per employee, coded OF.
- One schedule = whole hotel for a month; versions; one published per month
  (partial unique index). Editing is allowed on drafts and the published version
  until the month's hour bank is closed; archived versions are read-only.
- Validator: weekly hours vs contract are informational (8h reception shifts exceed
  the 37.5h contract by design and are returned as TL days); rest days on other
  weekdays and the monthly TL count are warnings.
- Hour-bank close excludes employees with empty days; reopen deletes the entries.
- Public holidays are generated (`src/lib/domain/holidays.ts`, country from the seed's
  `_meta.country`); add regional or company holidays in the app.
- `shift_ban` constraints become unavailabilities over the shift's hours;
  `shift_force` becomes a locked cell in the month's latest draft.
- pg-boss worker runs inside the Next.js server (`src/instrumentation.ts`);
  `DISABLE_JOB_WORKER=true` turns it off.
- Postgres must use UTF-8 (the Docker image does): notes may contain characters
  such as "−" that single-byte encodings cannot store.
- Printable monthly sheet: `src/server/pdf/schedule-pdf.ts` (pdfkit, standard
  Helvetica = Latin-1 only, so no characters such as "Δ" or "−" in PDF text); route
  `schedule/[year]/[month]/pdf?version=&section=`, viewers only get the published
  version. The header mark is drawn in code; the hotel name comes from `HOTEL_NAME`.
- "Fix" button: `src/lib/domain/repair.ts` generates local edits around one error
  (change a cell, swap two employees or two days, move a rest day, free a
  weekend), replays each through the validator and keeps the 5 best that fix it
  without any new error. Locked cells and approved absences are never moved.
  Actions in `schedule/fix-actions.ts`; applying re-checks each cell's value.
- Generation: "Generate" button (admins, months after the current one) →
  `schedule/generate-actions.ts` stores a `solver_runs` row with the request built
  by `src/server/solver/run.ts` → pg-boss `solve-schedule` job → POST
  `${SOLVER_URL}/solve` → new draft `source = solver`. The dialog polls the run.
  The worker registers its queues at server start: restart `pnpm dev` after
  adding a queue.
- Solver contract and model notes: `services/solver/README.md`.
- Demo mode (`DEMO_MODE=true`): guests via the Better Auth anonymous plugin
  (`app/demo-actions.ts`), role `demo` = guest manager. `plannerAction` (admin or
  demo) guards planning actions; `loadEditableSchedule` / `canSeeSchedule`
  (`server/schedules.ts`) restrict demo managers to their own drafts. Quotas in
  `server/demo/limits.ts`; hourly `demo-maintenance` job purges guests and calls
  `ensureDemoMonth` (`server/demo/reset.ts`: truncate + seed shifted to the current
  month with `shiftSeedFile` + `generateDemoSchedule`). Reference pages stay
  admin-only (`role === "admin"`).
- Deployment: Docker Compose + Caddy (`infra/`), or natively on Windows Server
  (`infra/windows/`, NSSM services `ShiftSmithWeb` / `ShiftSmithSolver`) with
  `next start`; the Docker image builds the standalone output
  (`NEXT_OUTPUT=standalone`). `infra/windows/update.ps1` builds into `.next-build`
  via `NEXT_DIST_DIR`, migrates, swaps, health-checks and rolls back on failure.
  Keep migrations additive: a rollback does not revert them.
