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
  const { pathname, search } = request.nextUrl;
  const isStart = pathname === "/start" || pathname.startsWith("/start/");
  if (!isStart && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/start", request.url));
  }
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const target = `/${locale}${pathname === "/" ? "" : pathname}${search}`;
  return NextResponse.rewrite(new URL(target, request.url));
}

export const config = {
  // API routes and static files (any path with an extension, e.g. the start page's
  // portrait) are neither redirected nor rewritten.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)",
  ],
};
