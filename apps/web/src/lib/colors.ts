/** Black or white text, whichever reads better on the given hex background. */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "#000000";
  const [r, g, b] = match.slice(1).map((h) => {
    const c = Number.parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#000000" : "#ffffff";
}

/**
 * Soft rendering of a shift or day-code color: a light tint of it as background and
 * a toned-down version as text, both mixed with the theme colors so they suit light
 * and dark mode.
 */
export function softCodeStyle(color: string) {
  return {
    backgroundColor: `color-mix(in oklab, ${color} 30%, var(--background))`,
    color: `color-mix(in oklab, ${color} 55%, var(--foreground))`,
  };
}
