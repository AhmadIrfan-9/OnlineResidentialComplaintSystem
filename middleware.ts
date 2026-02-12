import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the token from the request
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/(auth)/login"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route.replace(/\(/g, "").replace(/\)/g, ""))
  );

  // If public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If trying to access protected route without authentication
  if (!token) {
    // Redirect to login
    return NextResponse.redirect(new URL("/(auth)/login", request.url));
  }

  // Role-based route protection
  const userRole = token.role as string;
  const pathname_normalized = pathname.toLowerCase();

  // Warden routes
  if (pathname_normalized.startsWith("/warden")) {
    if (userRole !== "WARDEN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Staff routes
  if (pathname_normalized.startsWith("/staff")) {
    if (userRole !== "STAFF") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Student routes
  if (pathname_normalized.startsWith("/student")) {
    if (userRole !== "STUDENT") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Allow access if all checks pass
  return NextResponse.next();
}

// Configure which routes to protect
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
