import { describe, expect, it } from "vitest";
import {
  formatHours,
  formatHoursMinutes,
  formatTimeOfDay,
  parseTimeOfDay,
} from "./time";

describe("time of day", () => {
  it("parses and formats HH:MM including 24:00", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("08:30")).toBe(510);
    expect(parseTimeOfDay("24:00")).toBe(1440);
    expect(formatTimeOfDay(1440)).toBe("24:00");
    expect(formatTimeOfDay(510)).toBe("08:30");
  });

  it("rejects invalid values", () => {
    expect(() => parseTimeOfDay("24:30")).toThrow();
    expect(() => parseTimeOfDay("12:60")).toThrow();
    expect(() => parseTimeOfDay("noon")).toThrow();
  });

  it("formats durations", () => {
    expect(formatHours(456)).toBe("7.6h");
    expect(formatHours(-30)).toBe("-0.5h");
    expect(formatHoursMinutes(456, true)).toBe("+7h36");
    expect(formatHoursMinutes(-462)).toBe("-7h42");
  });
});
