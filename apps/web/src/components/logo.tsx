import type { CSSProperties } from "react";
import {
  LOGO_ACCENT,
  LOGO_ACCENT_CELL,
  LOGO_ACCENT_PATHS,
  LOGO_BLOCK_CELLS,
  LOGO_BLOCK_PATHS,
  LOGO_BLOCK_WAVE,
  LOGO_VIEWBOX,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Unit vector from the accent block to block `i`: the way the impact pushes it. */
function push(i: number) {
  const [column, row] = LOGO_BLOCK_CELLS[i];
  const dx = column - LOGO_ACCENT_CELL[0];
  const dy = row - LOGO_ACCENT_CELL[1];
  const length = Math.hypot(dx, dy);
  return { "--dx": dx / length, "--dy": dy / length };
}

/**
 * ShiftSmith mark. The blocks follow the text colour, so it works in both themes.
 * `animated`: the accent block comes in from the right, bounces once and lands in
 * its slot; the impact pushes the other blocks away from it, like a shock wave
 * (keyframes in globals.css, off with reduced motion).
 */
export function Logo({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      className={cn("size-5 shrink-0", animated && "logo-animated", className)}
      overflow={animated ? "visible" : undefined}
      aria-hidden="true"
    >
      {LOGO_BLOCK_PATHS.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="currentColor"
          className="logo-block"
          style={{ "--wave": LOGO_BLOCK_WAVE[i], ...push(i) } as CSSProperties}
        />
      ))}
      <g className="logo-accent">
        {LOGO_ACCENT_PATHS.map((d) => (
          <path key={d} d={d} fill={LOGO_ACCENT} />
        ))}
      </g>
    </svg>
  );
}
