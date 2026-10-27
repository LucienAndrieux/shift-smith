import type { ScheduleView } from "@/server/queries/schedule";

export type View = ScheduleView;
export type ViewShift = View["shiftTypes"][number];
export type ViewDayCode = View["dayCodes"][number];
export type ViewEmployee = View["employees"][number];
export type ViewCell = View["cells"][string][string];
export type ViewDate = View["dates"][number];

/** Fast lookups shared by the grid, week view and validation panel. */
export function indexView(view: View) {
  return {
    shiftById: new Map(view.shiftTypes.map((s) => [s.id, s])),
    dayCodeByCode: new Map(view.dayCodes.map((d) => [d.code, d])),
    sectionById: new Map(view.sections.map((s) => [s.id, s])),
    employeeById: new Map(view.employees.map((e) => [e.id, e])),
  };
}

export type ViewIndex = ReturnType<typeof indexView>;
