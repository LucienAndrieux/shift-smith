# Solver service

A Python **FastAPI** service using **OR-Tools CP-SAT** that generates a monthly
schedule. The web app calls it from the "Generate" button (months after the
current one) through a pg-boss job; the result becomes a new draft.

```
app/schemas.py   request/response models (camelCase on the wire)
app/model.py     the CP-SAT model
app/main.py      GET /health, POST /solve
tests/           pytest on a small reception case
```

Run locally (from the repo root): `docker compose up -d --build solver`
(listens on http://localhost:8000). Tests:

```bash
docker run --rm -v "$PWD/services/solver:/src" -w /src python:3.13-slim sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q"
```

Modelling choices: rest between shifts, consecutive days, two rest days (OF) per
ISO week, weekly shift limits, eligibility, unavailabilities, approved leave, locked
cells and birthdays are hard constraints. Staffing, monthly weekends off, couples,
different weekends, exact weekly counts, time off in lieu, rest on the fixed
weekdays, hour-bank balance and shift preferences are weighted objectives
(`options.weights`), so a schedule is always proposed when the hard rules allow one.

The contract mirrors the TypeScript domain types in
`apps/web/src/lib/domain/types.ts` (`MonthContext`, `Assignment`). The solver output
is checked by the **same validator** as hand-made schedules
(`apps/web/src/lib/domain/validator.ts`), so anything the solver returns is
validated before an admin publishes it.

## Flow

1. An admin clicks "Generate" for a month. The web app inserts a `solver_runs` row
   (`status = queued`, `input` = the request below) and enqueues a pg-boss job
   `solve-schedule`.
2. The worker sets `status = running`, `started_at`, and calls
   `POST {SOLVER_URL}/solve` with the request.
3. On success it stores the response in `solver_runs.output`, creates a new
   **draft** schedule (`source = solver`) with the returned assignments, sets
   `solver_runs.schedule_id`, `status = succeeded` and runs the validator.
4. When the problem has no solution it sets `status = infeasible` and shows the
   explanations; on any other error it sets `status = failed` and `error`.

The service is stateless: no database access, everything it needs is in the request.

## Conventions

- Dates are `YYYY-MM-DD` strings (calendar days in the hotel's time zone). Weekdays
  are ISO: 1 = Monday … 7 = Sunday. Weeks are ISO weeks (Monday → Sunday).
- Times of day are integer minutes from midnight, `0`–`1440` (`1440` = 24:00).
  A shift's periods all belong to the day it is assigned (the night shift D is
  00:00–07:30 on its own day).
- Paid minutes of a shift = Σ (end − start − unpaidBreakMinutes) over its periods.
- Ids are UUID strings from the web database.
- Exactly one of `shiftTypeId` / `dayCode` is set in an assignment.

## `POST /solve`

### Request

```jsonc
{
  "runId": "7a1c…",              // solver_runs.id
  "year": 2026,
  "month": 12,

  // ---- reference data (MonthContext) -------------------------------------
  "sections": [{ "id": "…", "code": "reception", "name": "Reception", "sortOrder": 10 }],
  "shiftTypes": [
    {
      "id": "…", "sectionId": "…", "code": "B", "isActive": true,
      "periods": [
        { "startMinute": 930, "endMinute": 1095, "unpaidBreakMinutes": 0 },
        { "startMinute": 1125, "endMinute": 1440, "unpaidBreakMinutes": 0 }
      ]
    }
  ],
  "dayCodes": [
    { "code": "OF", "label": "Day off (weekly rest)", "kind": "rest",
      "isDueDay": false, "creditsTime": false },
    { "code": "TL", "label": "Time off in lieu", "kind": "absence",
      "isDueDay": true, "creditsTime": false }
  ],
  "employees": [
    {
      "id": "…", "displayName": "Yuki Tanaka", "primarySectionId": "…",
      "status": "active",
      "weeklyContractMinutes": 2250,          // 37.5h
      "monthlyTlDays": 1,
      "requiresMonthlyWeekendOff": true,
      "birthdayMonth": 11, "birthdayDay": 14,
      "hiredOn": null, "leftOn": null,
      "fixedDaysOff": [ { "weekday": 3 }, { "weekday": 4 } ],
      "eligibility": [
        { "shiftTypeId": "…A", "preference": "preferred", "maxPerWeek": null, "exactPerWeek": null },
        { "shiftTypeId": "…E", "preference": "normal",    "maxPerWeek": 2,    "exactPerWeek": null }
      ]
    }
  ],
  "relations": [
    { "employeeAId": "…", "employeeBId": "…", "type": "same_days_off" },
    { "employeeAId": "…", "employeeBId": "…", "type": "different_weekend_off" }
  ],
  "absences": [                       // approved only; ranges are inclusive
    { "employeeId": "…", "dayCode": "AL", "startDate": "2026-12-14", "endDate": "2026-12-20" }
  ],
  "unavailabilities": [               // null start/end = whole day
    { "employeeId": "…", "date": "2026-12-09", "startMinute": 0, "endMinute": 780, "reason": "…" }
  ],
  "holidays": [ { "date": "2026-12-25", "name": "Christmas Day" } ],
  "staffingRequirements": [           // shiftTypeId null = any shift of the section; weekday null = every day
    { "sectionId": "…", "shiftTypeId": "…D", "weekday": null, "minStaff": 1, "maxStaff": null,
      "validFrom": null, "validTo": null }
  ],
  "staffingOverrides": [              // replaces the requirement of the same section+shift on that date
    { "sectionId": "…", "shiftTypeId": null, "date": "2026-12-12", "minStaff": 3, "maxStaff": null,
      "reason": "Trade fair" }
  ],
  "rules": [                          // most specific wins: employee > section > global
    { "code": "max_consecutive_work_days", "scope": "global", "sectionId": null, "employeeId": null,
      "value": { "value": 6 }, "isHard": true, "isActive": true }
  ],

  // ---- planning state ----------------------------------------------------
  "lockedAssignments": [              // must be kept exactly (manual decisions, prefilled absences)
    { "employeeId": "…", "date": "2026-12-04", "shiftTypeId": null, "dayCode": "OL", "isLocked": true }
  ],
  "previousAssignments": [            // last 7 days of the previous published month (boundary rules)
    { "employeeId": "…", "date": "2026-11-30", "shiftTypeId": "…B", "dayCode": null, "isLocked": false }
  ],
  "hourBankBalances": [               // minutes; + = owed to the employee
    { "employeeId": "…", "balanceMinutes": 480 }
  ],

  "options": {
    "timeLimitSeconds": 60,
    "weights": {                       // soft objectives, tunable
      "staffingShort": 1000,
      "tlDays": 60,
      "fixedDayOffMoved": 20,
      "hourBankPerHalfHour": 4
    }
  }
}
```

### Response — success

```jsonc
{
  "runId": "7a1c…",
  "status": "optimal",               // "optimal" | "feasible"
  "assignments": [                    // one cell per active employee per employed day
    { "employeeId": "…", "date": "2026-12-01", "shiftTypeId": "…E", "dayCode": null, "isLocked": false }
  ],
  "objective": 1234,
  "stats": { "wallTimeSeconds": 12.4, "conflicts": 10234, "branches": 88123 }
}
```

### Response — infeasible

```jsonc
{
  "runId": "7a1c…",
  "status": "infeasible",
  "assignments": [],
  "infeasibility": [
    { "rule": "hard_rules",
      "message": "No schedule satisfies the hard rules together with the locked cells and approved absences." }
  ]
}
```

Errors use HTTP 4xx/5xx with `{ "error": "message" }`.

## Constraints

Hard (when the rule is active and `isHard`; otherwise a penalised soft constraint):

| Rule (`scheduling_rules.code` or data) | Meaning |
|---|---|
| one value per cell | each employee/day gets exactly one shift or one day code |
| `lockedAssignments` | locked cells are fixed |
| `approved_leave_is_fixed` | approved absences fixed (fixed rest weekdays inside annual leave stay OF) |
| eligibility | shifts only from `eligibility`; `maxPerWeek` / `exactPerWeek` per ISO week |
| `min_rest_between_shifts_hours` | ≥ 11h between the end of a shift and the next start, across midnight (B ends 24:00, D starts 00:00 → 0h) |
| `max_consecutive_work_days` | ≤ 6 consecutive working days, including the previous-month tail |
| `two_rest_days_per_week` | 2 rest days (OF) per ISO week |
| `weekend_off_per_month` | employees with `requiresMonthlyWeekendOff`: ≥ 1 full Sat+Sun off |
| `birthday_off` | birthday coded BD |
| relations | `same_days_off`: identical rest days; `different_weekend_off`: never the same full weekend off |
| unavailabilities | no shift overlapping an unavailable window |
| staffing | per date/section/shift: `minStaff ≤ count ≤ maxStaff` (overrides replace requirements) |
| `monthlyTlDays` | number of time-off-in-lieu (TL) days in the month |

Soft objectives: keep rest days on the fixed weekdays, prefer `preferred` shifts and
avoid `rare` ones, and steer each employee's monthly hour-bank delta
(`worked + credited − expected`, see `apps/web/src/lib/domain/hour-bank.ts`)
towards bringing `balanceMinutes` back to zero. Expected time counts days with a
shift and days whose code `isDueDay`; credited time counts days whose code
`creditsTime`.

## Configuration

- `SOLVER_URL` (web app): `http://localhost:8000` in development,
  `http://solver:8000` in `infra/docker-compose.prod.yml` (no public port).
