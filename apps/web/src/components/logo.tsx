import type { CSSProperties } from "react";
import {
  LOGO_ACCENT,
  LOGO_ACCENT_PATHS,
  LOGO_BLOCK_PATHS,
  LOGO_BLOCK_WAVE,
  LOGO_VIEWBOX,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * ShiftSmith mark. The blocks follow the text colour, so it works in both themes.
 * `animated`: the accent block jumps in from the right and the other blocks ripple
 * like a wave (keyframes in globals.css, off with reduced motion).
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
          style={{ "--wave": LOGO_BLOCK_WAVE[i] } as CSSProperties}
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
