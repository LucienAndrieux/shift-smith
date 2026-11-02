import "server-only";
import { cookies } from "next/headers";
import { locale as localeParam } from "next/root-params";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { DICTIONARIES } from "./dictionaries";

/** Server Components: the `[locale]` root segment (set by proxy.ts from the cookie). */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  return DICTIONARIES[await getLocale()];
}

/** Server Actions and Route Handlers, where root params are not available. */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getRequestT() {
  return DICTIONARIES[await getRequestLocale()];
}
