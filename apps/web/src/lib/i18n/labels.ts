import { DEFAULT_DAY_CODES } from "@/lib/domain/day-codes";
import type { Dictionary } from "./dictionaries";

/**
 * Label of a day code in the interface language. Built-in codes keep their
 * translation while their label is the seeded English one; a label edited in the
 * app is data and shows as typed.
 */
export function dayCodeLabel(t: Dictionary, code: string, label: string) {
  const builtIn = DEFAULT_DAY_CODES.find((d) => d.code === code);
  return builtIn && builtIn.label === label
    ? (t.dayCodes[code as keyof Dictionary["dayCodes"]] ?? label)
    : label;
}
