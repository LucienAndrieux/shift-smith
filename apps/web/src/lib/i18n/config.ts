/**
 * Interface languages. The choice lives in the `locale` cookie; `proxy.ts` rewrites
 * every page to `/[locale]/…`, so URLs stay the same in every language.
 * Pure module: safe to import from domain code.
 */
export const LOCALES = ["en", "fr", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** BCP 47 tags for `Intl` formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  pt: "pt-PT",
};

/** Each language in its own name, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
};
