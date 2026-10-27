import PDFDocument from "pdfkit";
import {
  LOGO_ACCENT,
  LOGO_ACCENT_PATHS,
  LOGO_BLOCK_PATHS,
  LOGO_INK,
  LOGO_VIEWBOX,
} from "@/lib/brand";
import { readableTextColor } from "@/lib/colors";
import { formatMonth } from "@/lib/domain/calendar";
import { formatHoursMinutes } from "@/lib/domain/time";
import type { ScheduleView } from "@/server/queries/schedule";

/**
 * Printable monthly sheet: A4 landscape, header with the ShiftSmith mark, one
 * coloured grid per section with coverage rows and the section's shift hours.
 * Sections are packed several per page when they fit.
 * Uses the standard Helvetica fonts (WinAnsi): every text must stay Latin-1.
 */

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 28;
const BRAND = LOGO_INK;
const ACCENT = LOGO_ACCENT;
const GRID_LINE = "#CBD5E1";
const WEEKEND_FILL = "#EEF2F7";
const HOLIDAY_FILL = "#FDE7B0";
const SHORT_FILL = "#FDE2E2";
const SHORT_TEXT = "#C81E1E";
const MUTED = "#64748B";

const NAME_W = 118;
const TOTAL_W = 40;
const HEADER_H = 52;
const FOOTER_H = 30;
const SECTION_TITLE_H = 16;
const DAY_HEAD_H = 22;
const ROW_H = 16;
const COVERAGE_H = 12;
const LEGEND_LINE_H = 11;

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export interface SchedulePdfOptions {
  /** Sections to include, in display order (all when empty). */
  sectionIds: string[];
  /** Shown in the header and the document properties. */
  hotelName: string;
  generatedAt: string;
}

export function renderSchedulePdf(
  view: ScheduleView,
  options: SchedulePdfOptions,
): Promise<Buffer> {
  const schedule = view.schedule;
  if (!schedule) throw new Error("No schedule to render");

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Staff schedule - ${formatMonth(view.year, view.month)}`,
      Author: options.hotelName,
      Subject: `Version ${schedule.version} (${schedule.status})`,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const shiftById = new Map(view.shiftTypes.map((s) => [s.id, s]));
  const dayCodeByCode = new Map(view.dayCodes.map((d) => [d.code, d]));
  const totals = new Map(view.totals.map((t) => [t.employeeId, t.month]));
  const coverage = new Map(
    view.coverage.map((c) => [
      `${c.date}|${c.sectionId}|${c.shiftTypeId ?? "any"}`,
      c,
    ]),
  );
  const sections = view.sections.filter(
    (s) =>
      (options.sectionIds.length === 0 || options.sectionIds.includes(s.id)) &&
      view.employees.some((e) => e.sectionId === s.id),
  );
  const subtitle = sections.length === 1 ? sections[0].name : "All sections";

  const dayW = (PAGE.width - 2 * MARGIN - NAME_W - TOTAL_W) / view.dates.length;
  const contentTop = MARGIN + HEADER_H;
  const contentBottom = PAGE.height - MARGIN - FOOTER_H;

  const drawHeader = () => {
    // Logo drawn from its SVG path data.
    const logoH = 34;
    doc.save();
    doc.translate(MARGIN, MARGIN).scale(logoH / LOGO_VIEWBOX);
    for (const d of LOGO_BLOCK_PATHS) doc.path(d).fill(LOGO_INK);
    for (const d of LOGO_ACCENT_PATHS) doc.path(d).fill(LOGO_ACCENT);
    doc.restore();
    const textX = MARGIN + logoH + 12;
    doc
      .fillColor("#0F172A")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text("Staff schedule", textX, MARGIN + 1, { lineBreak: false });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        `${options.hotelName}  ·  ${subtitle}  ·  ${formatMonth(view.year, view.month)}`,
        textX,
        MARGIN + 20,
        { lineBreak: false },
      );
    const right = PAGE.width - MARGIN;
    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor("#0F172A")
      .text(
        `Version ${schedule.version} · ${schedule.status}`,
        right - 200,
        MARGIN + 2,
        {
          width: 200,
          align: "right",
        },
      );
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Generated ${options.generatedAt}`, right - 200, MARGIN + 16, {
        width: 200,
        align: "right",
      });
    // Header rule with a short accent.
    const ruleY = MARGIN + logoH + 8;
    doc.rect(MARGIN, ruleY, PAGE.width - 2 * MARGIN, 2).fill(BRAND);
    doc.rect(MARGIN, ruleY, 90, 2).fill(ACCENT);
  };

  const sectionHeight = (sectionId: string) => {
    const employees = view.employees.filter(
      (e) => e.sectionId === sectionId,
    ).length;
    const coverageRows = coverageKeys(sectionId).length;
    const legendLines = Math.ceil(
      view.shiftTypes.filter((s) => s.sectionId === sectionId && s.isActive)
        .length / 3,
    );
    return (
      SECTION_TITLE_H +
      DAY_HEAD_H +
      employees * ROW_H +
      coverageRows * COVERAGE_H +
      6 +
      legendLines * LEGEND_LINE_H +
      14
    );
  };

  function coverageKeys(sectionId: string): (string | null)[] {
    return [
      ...view.shiftTypes
        .filter((s) => s.sectionId === sectionId && s.isActive)
        .map((s) => s.id),
      ...(view.coverage.some(
        (c) => c.sectionId === sectionId && c.shiftTypeId === null,
      )
        ? [null]
        : []),
    ];
  }

  const cellText = (
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
      size?: number;
      bold?: boolean;
      color?: string;
      align?: "left" | "center" | "right";
    } = {},
  ) => {
    const size = opts.size ?? 7.5;
    doc
      .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(opts.color ?? "#0F172A")
      .text(
        text,
        x + (opts.align === "left" ? 4 : 0),
        y + (h - size) / 2 + 0.5,
        {
          width:
            opts.align === "left" ? w - 8 : opts.align === "right" ? w - 4 : w,
          align: opts.align ?? "center",
          lineBreak: false,
          ellipsis: true,
        },
      );
  };

  const drawSection = (
    section: ScheduleView["sections"][number],
    top: number,
  ) => {
    let y = top;
    const tableW = PAGE.width - 2 * MARGIN;
    const x0 = MARGIN;
    const dayX = (i: number) => x0 + NAME_W + i * dayW;

    // Section title band.
    doc.rect(x0, y, tableW, SECTION_TITLE_H).fill(BRAND);
    cellText(section.name, x0, y, tableW, SECTION_TITLE_H, {
      bold: true,
      size: 9,
      color: "#FFFFFF",
      align: "left",
    });
    y += SECTION_TITLE_H;

    // Day header (weekday letter + day number), weekends and holidays shaded.
    view.dates.forEach((d, i) => {
      const fill = d.holiday ? HOLIDAY_FILL : d.isWeekend ? WEEKEND_FILL : null;
      if (fill) doc.rect(dayX(i), y, dayW, DAY_HEAD_H).fill(fill);
      cellText(WEEKDAY_LETTERS[d.weekday - 1], dayX(i), y + 1, dayW, 9, {
        size: 6.5,
        color: MUTED,
      });
      cellText(String(d.day), dayX(i), y + 10, dayW, 11, {
        size: 8,
        bold: true,
      });
    });
    cellText("Employee", x0, y, NAME_W, DAY_HEAD_H, {
      bold: true,
      align: "left",
      size: 8,
    });
    cellText(
      "Hours",
      x0 + NAME_W + view.dates.length * dayW,
      y,
      TOTAL_W,
      DAY_HEAD_H,
      {
        bold: true,
        size: 7.5,
      },
    );
    const headTop = y;
    y += DAY_HEAD_H;

    // Employee rows.
    const employees = view.employees.filter((e) => e.sectionId === section.id);
    for (const employee of employees) {
      view.dates.forEach((d, i) => {
        const cell = view.cells[employee.id]?.[d.date];
        const shift = cell?.shiftTypeId
          ? shiftById.get(cell.shiftTypeId)
          : undefined;
        const dayCode = cell?.dayCode
          ? dayCodeByCode.get(cell.dayCode)
          : undefined;
        const color = shift?.color ?? dayCode?.color;
        if (color) {
          doc
            .rect(dayX(i) + 0.75, y + 0.75, dayW - 1.5, ROW_H - 1.5)
            .fill(color);
          cellText(
            shift?.code ?? dayCode?.code ?? "",
            dayX(i),
            y,
            dayW,
            ROW_H,
            {
              bold: true,
              size: dayCode && dayCode.code.length > 1 ? 6.5 : 7.5,
              color: readableTextColor(color),
            },
          );
        } else if (d.holiday || d.isWeekend) {
          doc
            .rect(dayX(i), y, dayW, ROW_H)
            .fill(d.holiday ? HOLIDAY_FILL : WEEKEND_FILL);
        }
      });
      cellText(employee.name, x0, y, NAME_W, ROW_H, { align: "left", size: 8 });
      const total = totals.get(employee.id);
      cellText(
        total ? formatHoursMinutes(total.workedMinutes) : "",
        x0 + NAME_W + view.dates.length * dayW,
        y,
        TOTAL_W,
        ROW_H,
        { size: 7.5, align: "right" },
      );
      y += ROW_H;
    }

    // Grid lines over the header and employee rows.
    doc.lineWidth(0.4).strokeColor(GRID_LINE);
    for (
      let row = headTop;
      row <= y + 0.01;
      row += row === headTop ? DAY_HEAD_H : ROW_H
    ) {
      doc
        .moveTo(x0, row)
        .lineTo(x0 + tableW, row)
        .stroke();
    }
    for (let i = 0; i <= view.dates.length; i++) {
      doc.moveTo(dayX(i), headTop).lineTo(dayX(i), y).stroke();
    }
    doc.moveTo(x0, headTop).lineTo(x0, y).stroke();
    doc
      .moveTo(x0 + tableW, headTop)
      .lineTo(x0 + tableW, y)
      .stroke();

    // Coverage rows: staff per shift and day, red below the minimum.
    for (const shiftTypeId of coverageKeys(section.id)) {
      const shift = shiftTypeId ? shiftById.get(shiftTypeId) : null;
      cellText(
        shift ? `Coverage ${shift.code}` : "Coverage (any)",
        x0,
        y,
        NAME_W,
        COVERAGE_H,
        {
          size: 6.5,
          color: MUTED,
          align: "right",
        },
      );
      view.dates.forEach((d, i) => {
        const c = coverage.get(
          `${d.date}|${section.id}|${shiftTypeId ?? "any"}`,
        );
        const short =
          c &&
          ((c.minStaff !== null && c.count < c.minStaff) ||
            (c.maxStaff !== null && c.count > c.maxStaff));
        if (short) doc.rect(dayX(i), y, dayW, COVERAGE_H).fill(SHORT_FILL);
        cellText(String(c?.count ?? 0), dayX(i), y, dayW, COVERAGE_H, {
          size: 6.5,
          bold: Boolean(short),
          color: short ? SHORT_TEXT : MUTED,
        });
      });
      y += COVERAGE_H;
    }

    // Shift hours for this section, three per line.
    y += 6;
    const shifts = view.shiftTypes.filter(
      (s) => s.sectionId === section.id && s.isActive,
    );
    const colW = tableW / 3;
    shifts.forEach((s, i) => {
      const lx = x0 + (i % 3) * colW;
      const ly = y + Math.floor(i / 3) * LEGEND_LINE_H;
      doc.rect(lx, ly + 1, 14, 9).fill(s.color);
      cellText(s.code, lx, ly + 1, 14, 9, {
        bold: true,
        size: 6.5,
        color: readableTextColor(s.color),
      });
      cellText(
        `${s.hours}  (${formatHoursMinutes(s.paidMinutes)} paid)`,
        lx + 16,
        ly,
        colW - 16,
        11,
        {
          size: 7,
          color: "#334155",
          align: "left",
        },
      );
    });
    return y + Math.ceil(shifts.length / 3) * LEGEND_LINE_H + 14;
  };

  // Lay out sections, starting a new page when the next one does not fit.
  drawHeader();
  let y = contentTop;
  for (const section of sections) {
    const h = sectionHeight(section.id);
    if (y > contentTop && y + h > contentBottom) {
      doc.addPage();
      drawHeader();
      y = contentTop;
    }
    y = drawSection(section, y);
  }

  // Footer on every page: day-code legend and page numbers.
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    // The footer sits in the bottom margin: lift the margin so pdfkit does not
    // add a page when text is drawn there.
    doc.page.margins.bottom = 0;
    const fy = PAGE.height - MARGIN - FOOTER_H + 10;
    let fx = MARGIN;
    for (const d of view.dayCodes) {
      const label = `${d.label}`;
      doc.rect(fx, fy, 16, 9).fill(d.color);
      cellText(d.code, fx, fy, 16, 9, {
        bold: true,
        size: 6,
        color: readableTextColor(d.color),
      });
      doc.font("Helvetica").fontSize(6.5);
      const w = doc.widthOfString(label) + 8;
      cellText(label, fx + 18, fy - 1, w, 11, {
        size: 6.5,
        color: MUTED,
        align: "left",
      });
      fx += 18 + w + 2;
    }
    cellText(
      `Page ${p - range.start + 1} / ${range.count}`,
      PAGE.width - MARGIN - 80,
      fy + 10,
      80,
      11,
      { size: 7, color: MUTED, align: "right" },
    );
  }

  doc.end();
  return done;
}
