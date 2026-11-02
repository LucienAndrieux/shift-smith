"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";
import { z } from "zod";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

const ZOD_LOCALES = { en: z.locales.en, fr: z.locales.fr, pt: z.locales.pt };

/** Gives client components the page's language (from the `[locale]` segment). */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  // Zod's built-in messages for client-side form validation (not during SSR: the
  // config is global to the process).
  useEffect(() => {
    z.config(ZOD_LOCALES[locale]());
  }, [locale]);
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  return DICTIONARIES[useContext(LocaleContext)];
}
