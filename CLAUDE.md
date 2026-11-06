# ShiftSmith — staff scheduling app

Self-hosted web app managing the monthly staff schedules of a small hotel
(~28 employees, 6 sections). The OR-Tools CP-SAT solver lives in
`services/solver` (Python/FastAPI) and generates drafts for future months.
All seed data is fictional (`docs/seed-data.json`, demo hotel "Demo Alpine Lodge").

## Conventions

- **Everything in English** (code, DB, docs). The UI is English, French and
  Portuguese: never hard-code interface text, add it to
  `src/lib/i18n/dictionaries/en.ts` and translate it in `fr.ts` and `pt.ts`.
  Day codes are OF, PH, AL, SL, BD,
  TL, TR, OL, UL (`src/lib/domain/day-codes.ts`); shift codes are A–E per section.
  Keep accents in names.
- Time zone from `APP_TIMEZONE` (default `Europe/Paris`); ISO weeks (Mon → Sun).
  Dates are `YYYY-MM-DD` strings in domain code; times of day are minutes from
  midnight (0–1440).
- Domain logic lives in `apps/web/src/lib/domain/`: pure TypeScript, no framework or
  DB imports, covered by Vitest. The validator there also checks solver output.
- Zod schemas are shared between server and client (`src/lib/schemas/`).
- Every manager mutation: Server Action → `requireManager()` → DB write → `audit()`.
  Reads go through `requireUser()`. Never rely on hidden buttons alone.
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
- Server Actions: `managerAction(schema, handler)` (or `userAction` when the
  handler checks the role itself) in `src/server/action.ts` (auth +
  Zod + `refresh()`); forms use `useZodForm` / `FormDialog`, which send the raw
  schema *input* so the action re-validates the same shape.
- TanStack Table is v9: use `DataTable` / `AppColumnDef` from
  `src/components/data-table.tsx` (feature registry, `sortFn` not `sortingFn`).
- When testing in the in-app browser with the pane hidden, streamed Suspense
  content is not revealed (no animation frames); read the server HTML instead.
- `proxy.ts` (formerly middleware) only does optimistic cookie redirects; real
  checks happen in the data access layer.
- Languages: every page lives under `app/[locale]/` (`en`, `fr`, `pt`, one static
  shell each); `next.config.ts` rewrites URLs (beforeFiles, by the `locale` cookie, English by
  default), so URLs carry no language. Server Components use `getT()` /
  `getLocale()` (`next/root-params`); Server Actions and Route Handlers use
  `getRequestT()` (cookie); client components `useT()` / `useLocale()`.
  `ActionError((t) => t.errors.…)` returns errors in the visitor's language.
  The validator writes messages in the locale it is given; shared Zod schemas keep
  English messages, translated for display by `translateMessage`. Data (names,
  sections, shift labels, holidays, DB notes) is not translated; built-in day-code
  labels are, while unchanged (`dayCodeLabel`). Switchers: flag buttons on the
  start page, a menu in the app sidebar (`components/language-switcher.tsx`).
  A shared link can carry `?lang=fr|pt|en` (rewrite before the cookie; the start
  page then stores it). Link previews: `lib/og.ts` Open Graph tags with the image
  of `app/api/og` (next/og, Bricolage font files in `assets/fonts`), absolute
  through `metadataBase` = `BETTER_AUTH_URL`.
- Biome for lint + format (shadcn files in `src/components/ui` are not linted).
- The single `.env` lives at the repo root; `next.config.ts` and
  `scripts/load-env.ts` load it.

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
  `_meta.country`: `FR`, `PT` or `GB-ENG` for England and Wales); add regional,
  municipal, one-off or company holidays in the app.
- Constraints have no target month: the text carries its dates, resolved against
  today. The model also answers `hasDate`; a note without any date is stored as
  failed with `NO_DATE` (`lib/constraints/check.ts`), except a permanent change of
  the fixed rest days. The old `target_year`/`target_month` columns keep the month
  the note was sent in.
- `shift_ban` constraints become unavailabilities over the shift's hours;
  `shift_force` becomes a locked cell in the version the manager picks when
  approving (a new draft copied from the published version, an existing draft or
  the published version; `placement` in `server/constraints/apply.ts`); the
  approval toast links to it. A wish to start or finish at a given time maps to the shift of the
  employee's section that starts or ends then (`server/constraints/parse.ts`).
- pg-boss worker runs inside the Next.js server (`src/instrumentation.ts`);
  `DISABLE_JOB_WORKER=true` turns it off.
- The sidebar's validation counts revalidate whole months: cached in memory per
  role and month (`server/validation-cache.ts`, on `globalThis`, 5-minute TTL),
  cleared by every write action (`guardedAction`) and every background job. A
  new write path outside those must call `invalidateValidationCounts()`.
- Month grid: cells are plain buttons (`data-cell="employeeId|date"`); one shared
  card (`schedule/[year]/[month]/cell-card.tsx`, Radix Popover on a virtual
  anchor) listens on the table, so hovering never re-renders the grid. Clicks
  never edit; the card holds the editor, the lock and "Solve".
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
- "Replan" button (managers, a non-archived version of the current month whose
  hour bank is open, until the month's last day but one): `startScheduleReplan`
  sends the version as `referenceAssignments` with `options.replanFrom` = tomorrow
  (`lib/domain/replan.ts`); the solver keeps the days before and penalises each
  changed cell after. Locks under an approved absence are released. Same job and
  dialog as Generate; the result is a new draft.
- Solver contract and model notes: `services/solver/README.md`.
- Showcase, no accounts: the start page (`/start`, `app/demo-actions.ts`) creates
  a Better Auth anonymous guest with role `manager` (every right on the shared
  data), `employee` (plays one employee via `user.employee_id`: published
  schedules, own profile, "My requests") or `viewer` (read-only). DB roles `admin`
  and `demo` from earlier versions read as `manager` (`server/session.ts`).
  Managers see every version, others the published ones (`canSeeSchedule`).
  Quotas in `server/demo/limits.ts`; hourly `demo-maintenance` job purges guests
  and calls `ensureDemoMonth` (`server/demo/reset.ts`: truncate + seed shifted to
  the current month with `shiftSeedFile` + `generateDemoSchedule`); nightly
  restore at 03:xx.
- Guided tour per role (`components/guided-tour.tsx`, driver.js themed in
  `guided-tour.css`): steps in `t.tour.<role>`, targets are `data-tour` attributes
  (`TARGETS`, same order; a missing or hidden target gives a centred card). Shown
  once per guest and role on the schedule screen (localStorage), replayed from the
  banner's "Guided tour" button.
- The start page is also the developer's sales page (custom builds) with a public
  contact form and a meeting request: a day/slot picker (`MEETING_SLOTS`,
  `lib/meeting-slots.ts`, weekdays from tomorrow) minus the busy times of a Google
  Calendar (`server/google-calendar.ts`, free/busy API, service account `GOOGLE_*`,
  re-checked on send), then a 30-minute `.ics` invitation built by `lib/ics.ts`,
  visitor as organizer: `app/(auth)/start/actions.ts` →
  `server/email.ts` (nodemailer, `SMTP_*`) to `CONTACT_EMAIL`; honeypot +
  in-memory per-address limit, no session required. Display font Bricolage Grotesque on that page only.
  Its pricing section shows three plans (one-off build "from" + monthly plan, the
  third on quote): texts in `start.plans` of the dictionaries, prices in euros in
  `PLAN_PRICES` of the page, one grid for every language (set for Portugal).
  Its "videos" section (`components/demo/video-tour.tsx`) plays four explainer
  videos from `public/videos` (English, subtitles burned in, same text as the
  `.vtt` caption tracks); titles in `start.videos`, durations in `VIDEOS`.
- Deployment: Docker Compose + Caddy (`infra/`), or natively on Windows Server
  (`infra/windows/`, NSSM services `ShiftSmithWeb` / `ShiftSmithSolver`) with
  `next start`; the Docker image builds the standalone output
  (`NEXT_OUTPUT=standalone`). `infra/windows/update.ps1` builds into `.next-build`
  via `NEXT_DIST_DIR`, migrates, swaps, health-checks and rolls back on failure.
  Keep migrations additive: a rollback does not revert them.
