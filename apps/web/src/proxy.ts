import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only: a missing session cookie sends the visitor to sign-in.
 * Real checks (session validity, approval, role) happen server-side in every page
 * and action via requireApprovedUser() / requireAdmin().
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|sign-in|sign-up|forgot-password|reset-password|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
