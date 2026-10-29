import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only: a visitor without a session cookie goes to the start
 * page to pick a role. Real checks happen server-side in every page and action via
 * requireUser() / requireManager().
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/start", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|start|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
