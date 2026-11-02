import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n/config";

/**
 * Optimistic redirect only: a visitor without a session cookie goes to the start
 * page to pick a role. Real checks happen server-side in every page and action via
 * requireUser() / requireManager(). The language rewrite to `app/[locale]/` lives in
 * next.config.ts; a path that already starts with a language is checked without it.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];
  const path = isLocale(first)
    ? pathname.slice(first.length + 1) || "/"
    : pathname;
  const isStart = path === "/start" || path.startsWith("/start/");
  if (!isStart && !getSessionCookie(request)) {
    // Keep the query: a shared `?lang=` link opens the start page in that language.
    const url = new URL("/start", request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API routes and static files (any path with an extension, e.g. the start page's
  // portrait) are not redirected.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)",
  ],
};
