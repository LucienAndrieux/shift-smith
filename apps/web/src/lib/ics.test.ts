import { describe, expect, it } from "vitest";
import { buildInvitation } from "./ics";

describe("buildInvitation", () => {
  const ics = buildInvitation({
    uid: "abc@shiftsmith",
    start: new Date("2026-11-03T09:00:00Z"),
    minutes: 30,
    summary: "Call: Test, about a 15-person restaurant",
    description: "Line one\nLine two; with a comma, too",
    organizer: { name: 'Ann "A" Smith', email: "ann@example.test" },
    attendee: { name: "Lucien Andrieux", email: "me@example.test" },
    now: new Date("2026-10-29T12:00:00Z"),
  });

  it("writes a 30-minute request in UTC", () => {
    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("DTSTART:20261103T090000Z\r\n");
    expect(ics).toContain("DTEND:20261103T093000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261029T120000Z\r\n");
  });

  it("escapes text and parameters", () => {
    expect(ics).toContain("SUMMARY:Call: Test\\, about a 15-person restaurant");
    expect(ics).toContain(
      "DESCRIPTION:Line one\\nLine two\\; with a comma\\, too",
    );
    expect(ics).toContain(
      `ORGANIZER;CN="Ann 'A' Smith":mailto:ann@example.test`,
    );
  });

  it("folds long lines at 75 octets", () => {
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    }
  });
});
