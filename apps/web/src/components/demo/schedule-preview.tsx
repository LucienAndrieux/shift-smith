import { Wand2 } from "lucide-react";
import { softCodeStyle } from "@/lib/colors";
import { DEFAULT_DAY_CODES } from "@/lib/domain/day-codes";
import { SHIFT_CODE_COLORS } from "@/lib/domain/seed-mapping";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  ...SHIFT_CODE_COLORS,
  ...Object.fromEntries(DEFAULT_DAY_CODES.map((d) => [d.code, d.color])),
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F"];

/** A fictional fortnight, one row per employee (decorative). */
const ROWS: { name: string; codes: string[] }[] = [
  { name: "Amara", codes: "D D D D D OF OF D D D D D".split(" ") },
  { name: "Chloé", codes: "A E OF OF E B B OF OF A B B".split(" ") },
  { name: "Henrik", codes: "OF OF A A E A A AL AL AL AL AL".split(" ") },
  { name: "Leila", codes: "C C A A OF B A TL A C C OF".split(" ") },
  { name: "Tomasz", codes: "B B OF OF B B B B B OF OF B".split(" ") },
  { name: "Yuki", codes: "E A A OF OF A A A TL A E OF".split(" ") },
];

/** Days shown on phones, so the preview fits without scrolling. */
const MOBILE_DAYS = 9;

/** The cell outlined in red, as in the real grid (row, day). */
const ERROR = { row: 3, day: 6 };

/** Stylised preview of the month grid for the start page. */
export function SchedulePreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border bg-card/80 shadow-xl shadow-black/5 backdrop-blur dark:shadow-black/30">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">November</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              published
            </span>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          </div>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="w-full border-separate border-spacing-0.5 text-[10px] sm:text-xs">
            <thead>
              <tr>
                <th className="w-16 text-left font-medium text-muted-foreground">
                  Reception
                </th>
                {DAYS.map((d, i) => (
                  <th
                    // biome-ignore lint/suspicious/noArrayIndexKey: static header
                    key={i}
                    className={cn(
                      "rounded py-0.5 font-medium text-muted-foreground",
                      i >= MOBILE_DAYS && "hidden sm:table-cell",
                      i === ERROR.day && "ring-2 ring-red-500 ring-inset",
                    )}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, r) => (
                <tr key={row.name}>
                  <td className="truncate pr-1 text-muted-foreground">
                    {row.name}
                  </td>
                  {row.codes.map((code, d) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: static grid
                      key={d}
                      className={cn(
                        "h-6 min-w-6 rounded text-center font-semibold sm:h-7",
                        d >= MOBILE_DAYS && "hidden sm:table-cell",
                        r === ERROR.row &&
                          d === ERROR.day &&
                          "ring-2 ring-red-500 ring-inset",
                      )}
                      style={softCodeStyle(COLORS[code] ?? "#9ca3af")}
                    >
                      {code}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating fix suggestion, pointing at the red cell. */}
      <div className="absolute -bottom-14 left-4 flex max-w-64 items-start gap-2.5 rounded-xl border bg-popover/95 p-3 text-xs shadow-lg backdrop-blur sm:left-auto sm:right-6">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[#E8590C]/15 text-[#E8590C]">
          <Wand2 className="size-3.5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Leila: only 7h30 rest after B</span>
          <span className="text-muted-foreground">
            3 fixes found, such as a swap with Chloé
          </span>
        </div>
      </div>
    </div>
  );
}
