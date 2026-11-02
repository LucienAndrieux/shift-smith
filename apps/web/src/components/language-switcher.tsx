"use client";

import { Check, Languages } from "lucide-react";
import { Flag } from "@/components/flags";
import { useLocale, useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCALE_COOKIE,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Stores the choice for a year; the reload re-renders every page in it. */
function chooseLocale(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: plain preference cookie, read by proxy.ts
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

/** Start page: one button per language, flag inside. */
export function LanguageButtons({ className }: { className?: string }) {
  const current = useLocale();
  const t = useT();
  return (
    <fieldset
      aria-label={t.common.language}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={active}
            onClick={() => !active && chooseLocale(locale)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-xs backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "border-[#E8590C]/50 bg-[#E8590C]/10 text-foreground"
                : "cursor-pointer bg-card/70 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
            )}
          >
            <Flag
              locale={locale}
              className="h-3.5 w-5 shrink-0 rounded-[3px] ring-1 ring-black/10"
            />
            {LOCALE_NAMES[locale]}
          </button>
        );
      })}
    </fieldset>
  );
}

/** App sidebar: the same choice in a compact menu. */
export function LanguageMenu({ align = "end" }: { align?: "start" | "end" }) {
  const current = useLocale();
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.common.language}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            lang={locale}
            onClick={() => locale !== current && chooseLocale(locale)}
          >
            <Flag
              locale={locale}
              className="h-3.5 w-5 rounded-[3px] ring-1 ring-black/10"
            />
            {LOCALE_NAMES[locale]}
            {locale === current && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
