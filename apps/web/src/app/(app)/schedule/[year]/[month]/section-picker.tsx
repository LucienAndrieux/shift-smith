"use client";

import {
  BedDouble,
  ChefHat,
  ConciergeBell,
  LayoutGrid,
  type LucideIcon,
  Package,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<string, LucideIcon> = {
  reception: ConciergeBell,
  housekeeping: BedDouble,
  restaurant: UtensilsCrossed,
  kitchen: ChefHat,
  storeroom: Package,
  maintenance: Wrench,
};

export interface SectionOption {
  /** null = all sections */
  id: string | null;
  code: string;
  name: string;
  count: number;
}

/** Pill-shaped section filter: icon, name and active headcount per section. */
export function SectionPicker({
  options,
  value,
  onChange,
}: {
  options: SectionOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    // One scrollable row on phones, wrapping pills from the sm breakpoint.
    <fieldset className="-mx-1 flex w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
      <legend className="sr-only">Section</legend>
      {options.map((option) => {
        const active = option.id === value;
        const Icon =
          option.id === null
            ? LayoutGrid
            : (SECTION_ICONS[option.code] ?? LayoutGrid);
        return (
          <button
            key={option.id ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "group inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-muted-foreground hover:-translate-y-px hover:border-foreground/20 hover:text-foreground hover:shadow-sm",
            )}
          >
            <Icon className="size-4" />
            {option.name}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
