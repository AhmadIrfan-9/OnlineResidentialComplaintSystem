import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Emergency Sign-Out Route
 * ─────────────────────────────────────────────────────────────────────────────
 * This endpoint is a last-resort escape hatch. It works by:
 *   1. Deleting all known NextAuth.js session cookies directly (v4 + v5 names)
 *   2. Redirecting to /login with a ?logout=emergency query param
 *
 * It does NOT rely on the NextAuth signOut() server action or any React state,
 * so it functions even if the UI is completely frozen or hydration has failed.
 *
 * Access via: GET /api/auth/emergency-signout
 */

const NEXTAUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.csrf-token",
  "__Secure-next-auth.csrf-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  // Auth.js v5 (next-auth v5) cookie names
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("logout", "emergency");

  const response = NextResponse.redirect(loginUrl, { status: 302 });

  // Forcefully expire every known auth cookie
  const isSecure = request.url.startsWith("https://");
  for (const cookieName of NEXTAUTH_COOKIE_NAMES) {
    // Only try deleting the __Secure- variants if we're on HTTPS
    if (cookieName.startsWith("__Secure-") && !isSecure) continue;
    response.cookies.set(cookieName, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieName.startsWith("__Secure-"),
    });
  }

  // Belt-and-suspenders: add aggressive no-cache headers
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");

  return response;
}
