import { describe, expect, it } from "vitest";
import { november2026 } from "./__fixtures__/seed";
import { prefillAssignments } from "./prefill";

describe("prefillAssignments", () => {
  const cells = prefillAssignments(november2026());
  const cell = (employee: string, date: string) =>
    cells.find((c) => c.employeeId === employee && c.date === date);

  it("places the fixed rest days as OF", () => {
    // Amara Okafor: Mon and Tue off.
    expect(cell("Amara Okafor", "2026-11-02")?.dayCode).toBe("OF");
    expect(cell("Amara Okafor", "2026-11-03")?.dayCode).toBe("OF");
    expect(cell("Amara Okafor", "2026-11-04")).toBeUndefined();
  });

  it("locks approved absences but keeps rest days inside annual leave", () => {
    // Henrik Lindqvist: AL from Nov 9 to Nov 15, rest days Thu/Fri.
    expect(cell("Henrik Lindqvist", "2026-11-09")).toMatchObject({
      dayCode: "AL",
      isLocked: true,
    });
    expect(cell("Henrik Lindqvist", "2026-11-12")).toMatchObject({
      dayCode: "OF",
      isLocked: false,
    });
  });

  it("marks birthdays as BD unless they fall on a rest day", () => {
    expect(cell("Yuki Tanaka", "2026-11-14")).toMatchObject({
      dayCode: "BD",
      isLocked: true,
    });
    const input = november2026();
    const amara = input.employees.find((e) => e.id === "Amara Okafor");
    if (amara) {
      amara.birthdayMonth = 11;
      amara.birthdayDay = 2; // a Monday, her rest day
    }
    const moved = prefillAssignments(input).find(
      (c) => c.employeeId === "Amara Okafor" && c.date === "2026-11-02",
    );
    expect(moved?.dayCode).toBe("OF");
  });

  it("fills a whole month of sick leave, rest days included", () => {
    const nadia = cells.filter((c) => c.employeeId === "Nadia Belkacem");
    expect(nadia).toHaveLength(30);
    expect(new Set(nadia.map((c) => c.dayCode))).toEqual(new Set(["SL"]));
  });
});
