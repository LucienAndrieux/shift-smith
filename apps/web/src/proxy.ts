import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

/**
 * - Optimistic redirect only: a visitor without a session cookie goes to the start
 *   page to pick a role. Real checks happen server-side in every page and action via
 *   requireUser() / requireManager().
 * - Language: every page lives under `app/[locale]/`; the URL stays the same and the
 *   `locale` cookie (English by default) picks the segment through a rewrite.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // `next start` runs the proxy again on the rewritten URL (/en/start): a path that
  // already starts with a language is checked without it and not rewritten twice.
  const first = pathname.split("/")[1];
  const localized = isLocale(first);
  const path = localized ? pathname.slice(first.length + 1) || "/" : pathname;
  const isStart = path === "/start" || path.startsWith("/start/");
  if (!isStart && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/start", request.url));
  }
  if (localized) return NextResponse.next();
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(target);
}

export const config = {
  // API routes and static files (any path with an extension, e.g. the start page's
  // portrait) are neither redirected nor rewritten.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)",
  ],
};
