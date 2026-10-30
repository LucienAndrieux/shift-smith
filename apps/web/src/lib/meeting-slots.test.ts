import { describe, expect, it } from "vitest";
import { MEETING_SLOTS } from "@/lib/schemas/contact";
import { freeSlots, isBusy, meetingDays, slotInterval } from "./meeting-slots";

const PARIS = "Europe/Paris";

describe("meeting slots", () => {
  it("offers 09:00–14:30 and 17:00–18:30 start times", () => {
    expect(MEETING_SLOTS[0]).toBe("09:00");
    expect(MEETING_SLOTS).toContain("14:30");
    expect(MEETING_SLOTS).not.toContain("15:00");
    expect(MEETING_SLOTS).not.toContain("16:30");
    expect(MEETING_SLOTS).toContain("17:00");
    expect(MEETING_SLOTS.at(-1)).toBe("18:30");
    expect(MEETING_SLOTS).toHaveLength(16);
  });

  it("keeps weekdays only, within the last day", () => {
    // 2026-10-30 is a Friday.
    expect(meetingDays("2026-10-30", 3, "2026-12-31")).toEqual([
      "2026-10-30",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(meetingDays("2026-10-30", 5, "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-11-02",
    ]);
  });

  it("converts Paris time to instants, across the DST change", () => {
    // Summer time until 25 October 2026, winter time after.
    expect(slotInterval("2026-10-23", "10:00", PARIS).start.toISOString()).toBe(
      "2026-10-23T08:00:00.000Z",
    );
    expect(slotInterval("2026-11-03", "10:00", PARIS).start.toISOString()).toBe(
      "2026-11-03T09:00:00.000Z",
    );
  });

  it("removes the slots overlapping a busy period", () => {
    // Busy 10:15–11:00 Paris time on 3 November (UTC+1).
    const busy = [
      {
        start: new Date("2026-11-03T09:15:00Z"),
        end: new Date("2026-11-03T10:00:00Z"),
      },
    ];
    const [day] = freeSlots(["2026-11-03"], busy, PARIS);
    expect(day.slots).toContain("09:30");
    expect(day.slots).not.toContain("10:00");
    expect(day.slots).not.toContain("10:30");
    // A busy period ending when a slot starts does not block it.
    expect(day.slots).toContain("11:00");
    expect(day.slots).toHaveLength(MEETING_SLOTS.length - 2);
  });

  it("treats touching ends as free", () => {
    const slot = slotInterval("2026-11-03", "09:00", PARIS);
    expect(
      isBusy(slot, [
        { start: slot.end, end: new Date(slot.end.getTime() + 1) },
      ]),
    ).toBe(false);
  });
});
