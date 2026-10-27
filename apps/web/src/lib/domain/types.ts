import type { IsoDate, Weekday } from "./calendar";
import type { ShiftPeriod } from "./durations";

/**
 * Framework-free domain model. These shapes are JSON-serialisable on purpose:
 * the same structure is sent to the solver and checked by the validator.
 */

export type DayCodeKind = "rest" | "absence" | "other";
export type ShiftPreference = "preferred" | "normal" | "rare";
export type RelationType = "same_days_off" | "different_weekend_off";

export interface Section {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface ShiftType {
  id: string;
  sectionId: string;
  code: string;
  isActive: boolean;
  periods: ShiftPeriod[];
}

export interface DayCode {
  code: string;
  label: string;
  kind: DayCodeKind;
  /** Counts in the contract time owed for the day. */
  isDueDay: boolean;
  /** Credited with the daily contract time. */
  creditsTime: boolean;
}

export interface FixedDayOff {
  weekday: Weekday;
}

export interface ShiftEligibility {
  shiftTypeId: string;
  preference: ShiftPreference;
  maxPerWeek: number | null;
  exactPerWeek: number | null;
}

export interface Employee {
  id: string;
  displayName: string;
  primarySectionId: string;
  status: "active" | "inactive";
  weeklyContractMinutes: number;
  /** Time-off-in-lieu (TL) days expected each month. */
  monthlyTlDays: number;
  requiresMonthlyWeekendOff: boolean;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  hiredOn: IsoDate | null;
  leftOn: IsoDate | null;
  fixedDaysOff: FixedDayOff[];
  eligibility: ShiftEligibility[];
}

export interface EmployeeRelation {
  employeeAId: string;
  employeeBId: string;
  type: RelationType;
}

/** Approved absences only (cancelled ones are filtered out before validation). */
export interface Absence {
  employeeId: string;
  dayCode: string;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface Unavailability {
  employeeId: string;
  date: IsoDate;
  /** null start/end = the whole day. */
  startMinute: number | null;
  endMinute: number | null;
  reason: string | null;
}

export interface Holiday {
  date: IsoDate;
  name: string;
}

export interface StaffingRequirement {
  sectionId: string;
  /** null = any shift of the section. */
  shiftTypeId: string | null;
  /** null = every day. */
  weekday: Weekday | null;
  minStaff: number;
  maxStaff: number | null;
  validFrom: IsoDate | null;
  validTo: IsoDate | null;
}

export interface StaffingOverride {
  sectionId: string;
  shiftTypeId: string | null;
  date: IsoDate;
  minStaff: number;
  maxStaff: number | null;
  reason: string | null;
}

export type RuleScope = "global" | "section" | "employee";

export interface SchedulingRule {
  code: string;
  scope: RuleScope;
  sectionId: string | null;
  employeeId: string | null;
  value: unknown;
  isHard: boolean;
  isActive: boolean;
}

/** One cell of the grid: exactly one of shiftTypeId / dayCode is set. */
export interface Assignment {
  employeeId: string;
  date: IsoDate;
  shiftTypeId: string | null;
  dayCode: string | null;
  isLocked: boolean;
}

/** Everything needed to validate (or generate) one month. */
export interface MonthContext {
  year: number;
  month: number;
  sections: Section[];
  shiftTypes: ShiftType[];
  dayCodes: DayCode[];
  employees: Employee[];
  relations: EmployeeRelation[];
  absences: Absence[];
  unavailabilities: Unavailability[];
  holidays: Holiday[];
  staffingRequirements: StaffingRequirement[];
  staffingOverrides: StaffingOverride[];
  rules: SchedulingRule[];
}

export interface ScheduleInput extends MonthContext {
  assignments: Assignment[];
  /**
   * Optional tail of the previous month (typically its last 7 days, from the published
   * schedule) so rules spanning the month boundary can be checked.
   */
  previousAssignments?: Assignment[];
}
