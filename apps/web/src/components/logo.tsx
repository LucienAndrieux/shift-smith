import {
  LOGO_ACCENT,
  LOGO_ACCENT_PATHS,
  LOGO_BLOCK_PATHS,
  LOGO_VIEWBOX,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

/** ShiftSmith mark. The blocks follow the text colour, so it works in both themes. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      className={cn("size-5 shrink-0", className)}
      aria-hidden="true"
    >
      {LOGO_BLOCK_PATHS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
      {LOGO_ACCENT_PATHS.map((d) => (
        <path key={d} d={d} fill={LOGO_ACCENT} />
      ))}
    </svg>
  );
}
