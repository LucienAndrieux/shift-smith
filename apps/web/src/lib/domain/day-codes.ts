import type { DayCode } from "./types";

/**
 * Built-in day codes. A day is either a shift or one of these codes.
 * - `isDueDay`: the day counts in the contract time owed (expected hours);
 * - `creditsTime`: the day is credited with the daily contract time.
 * A due day that credits nothing (TL) is paid from the hour bank; a day that is
 * neither due nor credited (OF, UL) leaves the bank untouched.
 */
export const REST_DAY = "OF";
export const PUBLIC_HOLIDAY = "PH";
export const ANNUAL_LEAVE = "AL";
export const SICK_LEAVE = "SL";
export const BIRTHDAY_LEAVE = "BD";
export const TIME_OFF_IN_LIEU = "TL";
export const TRAINING = "TR";
export const OTHER_PAID_LEAVE = "OL";
export const UNPAID_LEAVE = "UL";

export const DEFAULT_DAY_CODES: readonly (DayCode & { color: string })[] = [
  {
    code: REST_DAY,
    label: "Day off (weekly rest)",
    kind: "rest",
    isDueDay: false,
    creditsTime: false,
    color: "#22c55e",
  },
  {
    code: PUBLIC_HOLIDAY,
    label: "Public holiday",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#fb923c",
  },
  {
    code: ANNUAL_LEAVE,
    label: "Annual leave",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#facc15",
  },
  {
    code: SICK_LEAVE,
    label: "Sick leave",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#ef4444",
  },
  {
    code: BIRTHDAY_LEAVE,
    label: "Birthday leave",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#f472b6",
  },
  {
    code: TIME_OFF_IN_LIEU,
    label: "Time off in lieu",
    kind: "absence",
    isDueDay: true,
    creditsTime: false,
    color: "#a855f7",
  },
  {
    code: TRAINING,
    label: "Training",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#22d3ee",
  },
  {
    code: OTHER_PAID_LEAVE,
    label: "Other paid leave",
    kind: "absence",
    isDueDay: true,
    creditsTime: true,
    color: "#38bdf8",
  },
  {
    code: UNPAID_LEAVE,
    label: "Unpaid leave",
    kind: "absence",
    isDueDay: false,
    creditsTime: false,
    color: "#9ca3af",
  },
];
