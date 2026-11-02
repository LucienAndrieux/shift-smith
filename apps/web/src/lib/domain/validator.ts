import type { Locale } from "../i18n/config";
import {
  addDays,
  daysInMonth,
  formatDayMonth,
  type IsoDate,
  isDateInRange,
  isoWeeksOfMonth,
  monthDates,
  toIsoDate,
  weekday,
  weekdayShort,
} from "./calendar";
import { BIRTHDAY_LEAVE, PUBLIC_HOLIDAY, TIME_OFF_IN_LIEU } from "./day-codes";
import { computeShiftDuration, type ShiftDuration } from "./durations";
import { computeHourBank, type HourBankPeriodResult } from "./hour-bank";
import { type RuleCode, resolveRule } from "./rules";
import { formatTimeOfDay, MINUTES_PER_DAY } from "./time";
import type {
  Assignment,
  DayCode,
  Employee,
  ScheduleInput,
  ShiftType,
} from "./types";
import {
  VALIDATOR_MESSAGES,
  type ValidatorMessages,
} from "./validator-messages";

export type Severity = "error" | "warning";

export type ViolationCode =
  | RuleCode
  | "same_days_off"
  | "different_weekend_off"
  | "shift_eligibility"
  | "shift_max_per_week"
  | "shift_exact_per_week"
  | "inactive_shift"
  | "unavailability"
  | "min_staff"
  | "max_staff"
  | "unassigned_day"
  | "unknown_code"
  | "fixed_days_off_mismatch"
  | "monthly_tl_days";

/** English labels (scripts, logs); the UI uses `violationLabels(locale)`. */
export const VIOLATION_LABELS: Record<ViolationCode, string> =
  VALIDATOR_MESSAGES.en.labels;

export function violationLabels(locale: Locale): Record<ViolationCode, string> {
  return VALIDATOR_MESSAGES[locale].labels;
}

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  employeeId: string | null;
  sectionId: string | null;
  date: IsoDate | null;
  weekKey: string | null;
  /** Staffing violations: the shift concerned (null = any shift of the section). */
  shiftTypeId: string | null;
  message: string;
}

/** Identity of a violation, stable when only its message wording changes. */
export function violationIdentity(v: Violation): string {
  return [
    v.code,
    v.employeeId,
    v.sectionId,
    v.shiftTypeId,
    v.date,
    v.weekKey,
  ].join("|");
}

export interface WeeklyTotals extends HourBankPeriodResult {
  weekKey: string;
  /** Dates of the ISO week that fall inside the month. */
  dates: IsoDate[];
  isPartial: boolean;
  weeklyContractMinutes: number;
}

export interface EmployeeTotals {
  employeeId: string;
  month: HourBankPeriodResult;
  weeks: WeeklyTotals[];
  /** Count per shift type id. */
  shiftCounts: Record<string, number>;
  /** Count per day code. */
  dayCodeCounts: Record<string, number>;
}

export interface CoverageCell {
  date: IsoDate;
  sectionId: string;
  /** null = "any shift of the section". */
  shiftTypeId: string | null;
  count: number;
  minStaff: number | null;
  maxStaff: number | null;
}

export interface ValidationResult {
  violations: Violation[];
  employeeTotals: EmployeeTotals[];
  coverage: CoverageCell[];
}

type Cell = Pick<Assignment, "shiftTypeId" | "dayCode">;

/**
 * Validates one month of assignments against hard rules (and a few soft checks
 * reported as warnings). Pure function: same input, same output. Messages are
 * written in `locale`.
 */
export function validateSchedule(
  input: ScheduleInput,
  locale: Locale = "en",
): ValidationResult {
  return new Validator(input, locale).run();
}

class Validator {
  private readonly violations: Violation[] = [];
  private readonly dates: IsoDate[];
  private readonly monthStart: IsoDate;
  private readonly monthEnd: IsoDate;
  private readonly shiftById = new Map<string, ShiftType>();
  private readonly durationById = new Map<string, ShiftDuration>();
  private readonly dayCodeByCode = new Map<string, DayCode>();
  private readonly sectionNameById = new Map<string, string>();
  private readonly employeeById = new Map<string, Employee>();
  /** employeeId → date → cell, current month and previous-month tail. */
  private readonly cells = new Map<string, Map<IsoDate, Cell>>();
  private readonly employees: Employee[];
  readonly m: ValidatorMessages;

  constructor(
    private readonly input: ScheduleInput,
    readonly locale: Locale,
  ) {
    this.m = VALIDATOR_MESSAGES[locale];
    this.dates = monthDates(input.year, input.month);
    this.monthStart = this.dates[0];
    this.monthEnd = this.dates[this.dates.length - 1];
    for (const s of input.sections) this.sectionNameById.set(s.id, s.name);
    for (const st of input.shiftTypes) {
      this.shiftById.set(st.id, st);
      try {
        this.durationById.set(st.id, computeShiftDuration(st.periods));
      } catch {
        // Invalid periods: the shift counts as 0 minutes and is skipped by rest checks.
      }
    }
    for (const dc of input.dayCodes) this.dayCodeByCode.set(dc.code, dc);
    for (const e of input.employees) this.employeeById.set(e.id, e);
    this.employees = input.employees.filter((e) => e.status === "active");

    for (const a of [
      ...(input.previousAssignments ?? []),
      ...input.assignments,
    ]) {
      const inMonth = a.date >= this.monthStart && a.date <= this.monthEnd;
      const isTail = a.date < this.monthStart;
      if (!inMonth && !isTail) continue;
      let byDate = this.cells.get(a.employeeId);
      if (!byDate) {
        byDate = new Map();
        this.cells.set(a.employeeId, byDate);
      }
      byDate.set(a.date, { shiftTypeId: a.shiftTypeId, dayCode: a.dayCode });
    }
  }

  run(): ValidationResult {
    for (const employee of this.employees) this.checkEmployee(employee);
    this.checkRelations();
    const coverage = this.checkStaffing();
    const employeeTotals = this.employees.map((e) => this.totalsFor(e));
    this.violations.sort(
      (a, b) =>
        (a.date ?? "").localeCompare(b.date ?? "") ||
        a.code.localeCompare(b.code),
    );
    return { violations: this.violations, employeeTotals, coverage };
  }

  // ---------------------------------------------------------------- helpers

  private day(date: IsoDate): string {
    return formatDayMonth(date, this.locale);
  }

  private weekdays(days: number[]): string {
    return days.length === 0
      ? this.m.none
      : days
          .map((d) => weekdayShort(d as 1 | 2 | 3 | 4 | 5 | 6 | 7, this.locale))
          .join("/");
  }

  private cell(employeeId: string, date: IsoDate): Cell | undefined {
    return this.cells.get(employeeId)?.get(date);
  }

  private isEmployed(employee: Employee, date: IsoDate): boolean {
    return isDateInRange(date, employee.hiredOn, employee.leftOn);
  }

  private isWork(cell: Cell | undefined): boolean {
    return Boolean(cell?.shiftTypeId);
  }

  private dayKind(cell: Cell | undefined) {
    return cell?.dayCode
      ? this.dayCodeByCode.get(cell.dayCode)?.kind
      : undefined;
  }

  private isRest(cell: Cell | undefined): boolean {
    return this.dayKind(cell) === "rest";
  }

  private isOff(cell: Cell | undefined): boolean {
    return Boolean(cell?.dayCode);
  }

  private shiftLabel(shiftTypeId: string): string {
    const st = this.shiftById.get(shiftTypeId);
    if (!st) return this.m.unknownShiftLabel;
    return `${this.sectionNameById.get(st.sectionId) ?? ""} ${st.code}`.trim();
  }

  private name(employeeId: string): string {
    return this.employeeById.get(employeeId)?.displayName ?? employeeId;
  }

  private add(
    v: Omit<Violation, "weekKey" | "sectionId" | "shiftTypeId"> &
      Partial<Violation>,
  ) {
    this.violations.push({
      weekKey: null,
      sectionId: null,
      shiftTypeId: null,
      ...v,
    });
  }

  /** Severity for a rule-backed check, or null when the rule is disabled. */
  private ruleSeverity(code: RuleCode, employee?: Employee): Severity | null {
    const rule = resolveRule(this.input.rules, code, {
      employeeId: employee?.id,
      sectionId: employee?.primarySectionId,
    });
    if (!rule.isActive) return null;
    return rule.isHard ? "error" : "warning";
  }

  private rule<C extends RuleCode>(code: C, employee?: Employee) {
    return resolveRule(this.input.rules, code, {
      employeeId: employee?.id,
      sectionId: employee?.primarySectionId,
    });
  }

  /** Weekends whose Saturday and Sunday both fall inside the month. */
  private weekendsInMonth(): [IsoDate, IsoDate][] {
    return this.dates
      .filter((d) => weekday(d) === 6 && addDays(d, 1) <= this.monthEnd)
      .map((sat) => [sat, addDays(sat, 1)]);
  }

  // ---------------------------------------------------------------- per employee

  private checkEmployee(employee: Employee) {
    const id = employee.id;
    const employedDates = this.dates.filter((d) =>
      this.isEmployed(employee, d),
    );

    // Unassigned days (one aggregated warning) and unknown codes.
    const missing = employedDates.filter((d) => !this.cell(id, d));
    if (missing.length > 0) {
      this.add({
        code: "unassigned_day",
        severity: "warning",
        employeeId: id,
        sectionId: employee.primarySectionId,
        date: missing[0],
        message: this.m.unassigned(
          employee.displayName,
          missing.length,
          this.day(missing[0]),
        ),
      });
    }

    const eligible = new Map(
      employee.eligibility.map((e) => [e.shiftTypeId, e]),
    );
    for (const date of employedDates) {
      const cell = this.cell(id, date);
      if (!cell) continue;
      if (cell.shiftTypeId) {
        const shift = this.shiftById.get(cell.shiftTypeId);
        if (!shift) {
          this.add({
            code: "unknown_code",
            severity: "error",
            employeeId: id,
            date,
            message: this.m.unknownShift(employee.displayName, this.day(date)),
          });
          continue;
        }
        if (!eligible.has(shift.id)) {
          this.add({
            code: "shift_eligibility",
            severity: "error",
            employeeId: id,
            sectionId: shift.sectionId,
            date,
            message: this.m.notEligible(
              employee.displayName,
              this.shiftLabel(shift.id),
              this.day(date),
            ),
          });
        }
        if (!shift.isActive) {
          this.add({
            code: "inactive_shift",
            severity: "warning",
            employeeId: id,
            sectionId: shift.sectionId,
            date,
            message: this.m.inactiveShift(
              this.shiftLabel(shift.id),
              employee.displayName,
              this.day(date),
            ),
          });
        }
      } else if (cell.dayCode && !this.dayCodeByCode.has(cell.dayCode)) {
        this.add({
          code: "unknown_code",
          severity: "error",
          employeeId: id,
          date,
          message: this.m.unknownDayCode(
            employee.displayName,
            cell.dayCode,
            this.day(date),
          ),
        });
      }
    }

    this.checkMinRest(employee);
    this.checkConsecutiveDays(employee);
    this.checkWeeks(employee);
    this.checkWeekendOff(employee);
    this.checkBirthday(employee);
    this.checkApprovedLeave(employee);
    this.checkUnavailabilities(employee);
    this.checkMonthlyTimeOffInLieu(employee, missing.length);
  }

  private checkMinRest(employee: Employee) {
    const severity = this.ruleSeverity(
      "min_rest_between_shifts_hours",
      employee,
    );
    if (!severity) return;
    const minRest =
      this.rule("min_rest_between_shifts_hours", employee).value.value * 60;
    for (const date of this.dates) {
      const today = this.cell(employee.id, date);
      const yesterday = this.cell(employee.id, addDays(date, -1));
      if (!today?.shiftTypeId || !yesterday?.shiftTypeId) continue;
      const prev = this.durationById.get(yesterday.shiftTypeId);
      const cur = this.durationById.get(today.shiftTypeId);
      if (!prev || !cur) continue;
      const rest = MINUTES_PER_DAY + cur.firstStartMinute - prev.lastEndMinute;
      if (rest < minRest) {
        this.add({
          code: "min_rest_between_shifts_hours",
          severity,
          employeeId: employee.id,
          sectionId: employee.primarySectionId,
          date,
          message: this.m.minRest({
            name: employee.displayName,
            rest: formatRest(rest),
            prevShift: this.shiftLabel(yesterday.shiftTypeId),
            prevEnd: formatTimeOfDay(prev.lastEndMinute),
            prevDate: this.day(addDays(date, -1)),
            shift: this.shiftLabel(today.shiftTypeId),
            start: formatTimeOfDay(cur.firstStartMinute),
            min: formatRest(minRest),
          }),
        });
      }
    }
  }

  private checkConsecutiveDays(employee: Employee) {
    const severity = this.ruleSeverity("max_consecutive_work_days", employee);
    if (!severity) return;
    const max = this.rule("max_consecutive_work_days", employee).value.value;
    // Start counting in the previous-month tail so runs crossing the boundary count.
    let date = addDays(this.monthStart, -14);
    let streak = 0;
    let streakStart = date;
    while (date <= this.monthEnd) {
      if (this.isWork(this.cell(employee.id, date))) {
        if (streak === 0) streakStart = date;
        streak++;
        if (streak === max + 1 && date >= this.monthStart) {
          this.add({
            code: "max_consecutive_work_days",
            severity,
            employeeId: employee.id,
            sectionId: employee.primarySectionId,
            date,
            message: this.m.consecutive(
              employee.displayName,
              max,
              this.day(streakStart),
            ),
          });
        }
      } else {
        streak = 0;
      }
      date = addDays(date, 1);
    }
  }

  private checkWeeks(employee: Employee) {
    const restSeverity = this.ruleSeverity("two_rest_days_per_week", employee);
    const fixedWeekdays = new Set(employee.fixedDaysOff.map((f) => f.weekday));

    for (const week of isoWeeksOfMonth(this.input.year, this.input.month)) {
      const known = week.dates.filter(
        (d) =>
          this.isEmployed(employee, d) &&
          (this.cell(employee.id, d) !== undefined ||
            (d >= this.monthStart && d <= this.monthEnd)),
      );
      const cells = known.map((d) => ({
        date: d,
        cell: this.cell(employee.id, d),
      }));
      const complete =
        cells.length === 7 && cells.every((c) => c.cell !== undefined);
      const unknownDays = 7 - cells.filter((c) => c.cell !== undefined).length;
      const restCells = cells.filter((c) => this.isRest(c.cell));
      const hasWork = cells.some((c) => this.isWork(c.cell));
      const hasAbsence = cells.some((c) => this.dayKind(c.cell) === "absence");
      const firstInMonth =
        week.dates.find((d) => d >= this.monthStart && d <= this.monthEnd) ??
        week.dates[0];

      // Two rest days per ISO week (impossible to satisfy even with unknown days).
      if (restSeverity && hasWork && restCells.length + unknownDays < 2) {
        this.add({
          code: "two_rest_days_per_week",
          severity: restSeverity,
          employeeId: employee.id,
          sectionId: employee.primarySectionId,
          date: firstInMonth,
          weekKey: week.key,
          message: this.m.restDays(
            employee.displayName,
            restCells.length,
            week.key,
          ),
        });
      }

      if (complete && !hasAbsence && fixedWeekdays.size > 0) {
        const actual = restCells.map((c) => weekday(c.date)).sort();
        const expected = [...fixedWeekdays].sort();
        if (actual.join() !== expected.join()) {
          this.add({
            code: "fixed_days_off_mismatch",
            severity: "warning",
            employeeId: employee.id,
            sectionId: employee.primarySectionId,
            date: firstInMonth,
            weekKey: week.key,
            message: this.m.fixedDaysOff(
              employee.displayName,
              week.key,
              this.weekdays(actual),
              this.weekdays(expected),
            ),
          });
        }
      }

      // Per-shift weekly limits.
      for (const elig of employee.eligibility) {
        const count = cells.filter(
          (c) => c.cell?.shiftTypeId === elig.shiftTypeId,
        ).length;
        const label = this.shiftLabel(elig.shiftTypeId);
        if (elig.maxPerWeek !== null && count > elig.maxPerWeek) {
          this.add({
            code: "shift_max_per_week",
            severity: "error",
            employeeId: employee.id,
            sectionId: employee.primarySectionId,
            date: firstInMonth,
            weekKey: week.key,
            message: this.m.maxPerWeek(
              employee.displayName,
              count,
              label,
              week.key,
              elig.maxPerWeek,
            ),
          });
        }
        if (elig.exactPerWeek !== null) {
          const mustBeExact = complete && !hasAbsence;
          if (
            (mustBeExact && count !== elig.exactPerWeek) ||
            count > elig.exactPerWeek
          ) {
            this.add({
              code: "shift_exact_per_week",
              severity: "error",
              employeeId: employee.id,
              sectionId: employee.primarySectionId,
              date: firstInMonth,
              weekKey: week.key,
              message: this.m.exactPerWeek(
                employee.displayName,
                count,
                label,
                week.key,
                elig.exactPerWeek,
              ),
            });
          }
        }
      }
    }
  }

  private checkWeekendOff(employee: Employee) {
    if (!employee.requiresMonthlyWeekendOff) return;
    const severity = this.ruleSeverity("weekend_off_per_month", employee);
    if (!severity) return;
    const required = this.rule("weekend_off_per_month", employee).value.value;
    const weekends = this.weekendsInMonth().filter(
      ([sat, sun]) =>
        this.isEmployed(employee, sat) && this.isEmployed(employee, sun),
    );
    const off = weekends.filter(
      ([sat, sun]) =>
        this.isOff(this.cell(employee.id, sat)) &&
        this.isOff(this.cell(employee.id, sun)),
    );
    if (off.length < required) {
      this.add({
        code: "weekend_off_per_month",
        severity,
        employeeId: employee.id,
        sectionId: employee.primarySectionId,
        date: null,
        message: this.m.weekendOff(employee.displayName, off.length, required),
      });
    }
  }

  private checkBirthday(employee: Employee) {
    if (employee.birthdayMonth !== this.input.month || !employee.birthdayDay) {
      return;
    }
    const severity = this.ruleSeverity("birthday_off", employee);
    if (!severity) return;
    const rule = this.rule("birthday_off", employee).value;
    if (!rule.value) return;
    const code = rule.code_used ?? BIRTHDAY_LEAVE;
    const day = Math.min(
      employee.birthdayDay,
      daysInMonth(this.input.year, this.input.month),
    );
    const date = toIsoDate(this.input.year, this.input.month, day);
    if (!this.isEmployed(employee, date)) return;
    const cell = this.cell(employee.id, date);
    if (cell?.dayCode !== code) {
      this.add({
        code: "birthday_off",
        severity,
        employeeId: employee.id,
        sectionId: employee.primarySectionId,
        date,
        message: this.m.birthday(
          employee.displayName,
          this.day(date),
          code,
          describeCell(cell, this),
        ),
      });
    }
  }

  private checkApprovedLeave(employee: Employee) {
    const severity = this.ruleSeverity("approved_leave_is_fixed", employee);
    if (!severity) return;
    const holidays = new Set(this.input.holidays.map((h) => h.date));
    for (const absence of this.input.absences) {
      if (absence.employeeId !== employee.id) continue;
      for (const date of this.dates) {
        if (date < absence.startDate || date > absence.endDate) continue;
        if (!this.isEmployed(employee, date)) continue;
        const cell = this.cell(employee.id, date);
        // Empty cells are reported once as unassigned days. Leave ranges are calendar
        // ranges: rest days and public holidays inside them keep their own code.
        if (!cell || cell.dayCode === absence.dayCode || this.isRest(cell))
          continue;
        if (cell.dayCode === PUBLIC_HOLIDAY && holidays.has(date)) continue;
        this.add({
          code: "approved_leave_is_fixed",
          severity,
          employeeId: employee.id,
          sectionId: employee.primarySectionId,
          date,
          message: this.m.approvedLeave(
            employee.displayName,
            absence.dayCode,
            this.day(date),
            describeCell(cell, this),
          ),
        });
      }
    }
  }

  private checkUnavailabilities(employee: Employee) {
    for (const u of this.input.unavailabilities) {
      if (u.employeeId !== employee.id) continue;
      if (u.date < this.monthStart || u.date > this.monthEnd) continue;
      const cell = this.cell(employee.id, u.date);
      if (!cell?.shiftTypeId) continue;
      const shift = this.shiftById.get(cell.shiftTypeId);
      if (!shift) continue;
      const wholeDay = u.startMinute === null || u.endMinute === null;
      const overlaps =
        wholeDay ||
        shift.periods.some(
          (p) =>
            p.startMinute < (u.endMinute ?? MINUTES_PER_DAY) &&
            p.endMinute > (u.startMinute ?? 0),
        );
      if (!overlaps) continue;
      const window = wholeDay
        ? this.m.allDay
        : `${formatTimeOfDay(u.startMinute ?? 0)}–${formatTimeOfDay(u.endMinute ?? MINUTES_PER_DAY)}`;
      this.add({
        code: "unavailability",
        severity: "error",
        employeeId: employee.id,
        sectionId: shift.sectionId,
        date: u.date,
        message: `${this.m.unavailable(employee.displayName, window, this.day(u.date), this.shiftLabel(shift.id))}${u.reason ? ` (${u.reason})` : ""}.`,
      });
    }
  }

  private checkMonthlyTimeOffInLieu(employee: Employee, unassigned: number) {
    if (unassigned > 0) return;
    const count = this.dates.filter(
      (d) => this.cell(employee.id, d)?.dayCode === TIME_OFF_IN_LIEU,
    ).length;
    if (count !== employee.monthlyTlDays) {
      this.add({
        code: "monthly_tl_days",
        severity: "warning",
        employeeId: employee.id,
        sectionId: employee.primarySectionId,
        date: null,
        message: this.m.monthlyTl(
          employee.displayName,
          count,
          TIME_OFF_IN_LIEU,
          employee.monthlyTlDays,
        ),
      });
    }
  }

  // ---------------------------------------------------------------- relations

  private checkRelations() {
    for (const rel of this.input.relations) {
      const a = this.employeeById.get(rel.employeeAId);
      const b = this.employeeById.get(rel.employeeBId);
      if (!a || !b || a.status !== "active" || b.status !== "active") continue;
      const pair = `${a.displayName} & ${b.displayName}`;

      if (rel.type === "same_days_off") {
        const severity = this.ruleSeverity("two_rest_days_per_week") ?? "error";
        for (const date of this.dates) {
          if (!this.isEmployed(a, date) || !this.isEmployed(b, date)) continue;
          const ca = this.cell(a.id, date);
          const cb = this.cell(b.id, date);
          const mismatch =
            (this.isRest(ca) && this.isWork(cb)) ||
            (this.isRest(cb) && this.isWork(ca));
          if (!mismatch) continue;
          const resting = this.isRest(ca) ? a : b;
          this.add({
            code: "same_days_off",
            severity,
            employeeId: a.id,
            date,
            message: this.m.sameDaysOff(
              pair,
              resting.displayName,
              this.day(date),
            ),
          });
        }
      } else {
        for (const [sat, sun] of this.weekendsInMonth()) {
          const bothOff = [a, b].every(
            (e) =>
              this.isOff(this.cell(e.id, sat)) &&
              this.isOff(this.cell(e.id, sun)),
          );
          if (bothOff) {
            this.add({
              code: "different_weekend_off",
              severity: "error",
              employeeId: a.id,
              date: sat,
              message: this.m.differentWeekend(
                pair,
                this.day(sat),
                this.day(sun),
              ),
            });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- staffing

  private checkStaffing(): CoverageCell[] {
    const coverage: CoverageCell[] = [];
    const activeIds = new Set(this.employees.map((e) => e.id));

    for (const date of this.dates) {
      const counts = new Map<string, number>(); // shiftTypeId → count
      for (const [employeeId, byDate] of this.cells) {
        if (!activeIds.has(employeeId)) continue;
        const shiftTypeId = byDate.get(date)?.shiftTypeId;
        if (shiftTypeId)
          counts.set(shiftTypeId, (counts.get(shiftTypeId) ?? 0) + 1);
      }

      for (const section of this.input.sections) {
        const sectionShifts = this.input.shiftTypes.filter(
          (s) => s.sectionId === section.id,
        );
        const targets = this.staffingTargets(section.id, date);
        const keys = new Set<string | null>([
          ...sectionShifts.filter((s) => s.isActive).map((s) => s.id),
          ...targets.keys(),
        ]);
        for (const shiftTypeId of keys) {
          const count =
            shiftTypeId === null
              ? sectionShifts.reduce((n, s) => n + (counts.get(s.id) ?? 0), 0)
              : (counts.get(shiftTypeId) ?? 0);
          const target = targets.get(shiftTypeId);
          coverage.push({
            date,
            sectionId: section.id,
            shiftTypeId,
            count,
            minStaff: target?.minStaff ?? null,
            maxStaff: target?.maxStaff ?? null,
          });
          if (!target) continue;
          const what =
            shiftTypeId === null
              ? this.m.anyShift(section.name)
              : this.shiftLabel(shiftTypeId);
          if (count < target.minStaff) {
            this.add({
              code: "min_staff",
              severity: "error",
              employeeId: null,
              sectionId: section.id,
              shiftTypeId,
              date,
              message: `${this.m.minStaff(what, this.day(date), count, target.minStaff)}${target.reason ? ` (${target.reason})` : ""}.`,
            });
          }
          if (target.maxStaff !== null && count > target.maxStaff) {
            this.add({
              code: "max_staff",
              severity: "error",
              employeeId: null,
              sectionId: section.id,
              shiftTypeId,
              date,
              message: `${this.m.maxStaff(what, this.day(date), count, target.maxStaff)}${target.reason ? ` (${target.reason})` : ""}.`,
            });
          }
        }
      }
    }
    return coverage;
  }

  /**
   * Effective min/max per shift (null = any shift) for a section and date.
   * A date override replaces the requirement for the same shift; a weekday-specific
   * requirement wins over an every-day one.
   */
  private staffingTargets(sectionId: string, date: IsoDate) {
    const targets = new Map<
      string | null,
      {
        minStaff: number;
        maxStaff: number | null;
        reason: string | null;
        specific: boolean;
      }
    >();
    const day = weekday(date);
    for (const r of this.input.staffingRequirements) {
      if (r.sectionId !== sectionId) continue;
      if (!isDateInRange(date, r.validFrom, r.validTo)) continue;
      if (r.weekday !== null && r.weekday !== day) continue;
      const existing = targets.get(r.shiftTypeId);
      const specific = r.weekday !== null;
      if (existing?.specific && !specific) continue;
      targets.set(r.shiftTypeId, {
        minStaff: r.minStaff,
        maxStaff: r.maxStaff,
        reason: null,
        specific,
      });
    }
    for (const o of this.input.staffingOverrides) {
      if (o.sectionId !== sectionId || o.date !== date) continue;
      targets.set(o.shiftTypeId, {
        minStaff: o.minStaff,
        maxStaff: o.maxStaff,
        reason: o.reason,
        specific: true,
      });
    }
    return targets;
  }

  // ---------------------------------------------------------------- totals

  private totalsFor(employee: Employee): EmployeeTotals {
    const assignments = this.dates.flatMap((date) => {
      const cell = this.cell(employee.id, date);
      return cell ? [{ date, ...cell }] : [];
    });
    const shiftPaidMinutes = new Map(
      [...this.durationById].map(([id, d]) => [id, d.paidMinutes]),
    );
    const base = {
      employee,
      assignments,
      shiftPaidMinutes,
      dayCodes: this.dayCodeByCode,
    };
    const shiftCounts: Record<string, number> = {};
    const dayCodeCounts: Record<string, number> = {};
    for (const a of assignments) {
      if (a.shiftTypeId) {
        shiftCounts[a.shiftTypeId] = (shiftCounts[a.shiftTypeId] ?? 0) + 1;
      } else if (a.dayCode) {
        dayCodeCounts[a.dayCode] = (dayCodeCounts[a.dayCode] ?? 0) + 1;
      }
    }
    return {
      employeeId: employee.id,
      month: computeHourBank({ ...base, dates: this.dates }),
      weeks: isoWeeksOfMonth(this.input.year, this.input.month).map((week) => {
        const dates = week.dates.filter(
          (d) => d >= this.monthStart && d <= this.monthEnd,
        );
        return {
          ...computeHourBank({ ...base, dates }),
          weekKey: week.key,
          dates,
          isPartial: dates.length < 7,
          weeklyContractMinutes: employee.weeklyContractMinutes,
        };
      }),
      shiftCounts,
      dayCodeCounts,
    };
  }

  describeShift(shiftTypeId: string): string {
    return this.shiftLabel(shiftTypeId);
  }
}

function describeCell(cell: Cell | undefined, v: Validator): string {
  if (!cell) return v.m.emptyCell;
  if (cell.shiftTypeId) return v.m.shiftCell(v.describeShift(cell.shiftTypeId));
  return cell.dayCode ?? v.m.emptyCell;
}

function formatRest(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Violations grouped for summaries: code → count, split by severity. */
export function summarizeViolations(
  violations: readonly Violation[],
  locale: Locale = "en",
) {
  const summary = new Map<ViolationCode, { error: number; warning: number }>();
  for (const v of violations) {
    const entry = summary.get(v.code) ?? { error: 0, warning: 0 };
    entry[v.severity]++;
    summary.set(v.code, entry);
  }
  return [...summary.entries()]
    .map(([code, counts]) => ({
      code,
      label: VALIDATOR_MESSAGES[locale].labels[code],
      ...counts,
    }))
    .sort((a, b) => b.error - a.error || b.warning - a.warning);
}
