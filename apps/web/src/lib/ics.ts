/**
 * Minimal iCalendar (RFC 5545) invitation: one event, times in UTC. Mail clients
 * such as Gmail show it with Yes / No / Maybe buttons.
 */
export interface Invitation {
  uid: string;
  start: Date;
  minutes: number;
  summary: string;
  description: string;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
  /** Creation time (DTSTAMP). */
  now?: Date;
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Escapes a TEXT value (backslash, semicolon, comma, newline). */
const text = (value: string) =>
  value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Quoted parameter value (CN): double quotes are not allowed inside. */
const param = (value: string) => `"${value.replace(/"/g, "'")}"`;

/** Folds lines longer than 75 octets, as the format requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildInvitation(inv: Invitation): string {
  const end = new Date(inv.start.getTime() + inv.minutes * 60_000);
  return `${[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftSmith//Meeting request//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${inv.uid}`,
    `DTSTAMP:${stamp(inv.now ?? new Date())}`,
    `DTSTART:${stamp(inv.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(inv.summary)}`,
    `DESCRIPTION:${text(inv.description)}`,
    `ORGANIZER;CN=${param(inv.organizer.name)}:mailto:${inv.organizer.email}`,
    `ATTENDEE;CN=${param(inv.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${inv.attendee.email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")}\r\n`;
}
