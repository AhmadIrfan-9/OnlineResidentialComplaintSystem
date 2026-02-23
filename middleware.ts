import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  dashboardPathByRole,
  isAdminRole,
  isManagementRole,
  isStudentRole,
} from "@/lib/roles";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static and auth API paths quickly.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Get the token from the request
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/login"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(route)
  );

  // If public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If trying to access protected route without authentication
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  const userRole = token.role;
  const pathnameNormalized = pathname.toLowerCase();

  const wantsStudentArea =
    pathnameNormalized.startsWith("/student") ||
    pathnameNormalized.startsWith("/dashboard/student") ||
    pathnameNormalized.startsWith("/complaints");

  const wantsWardenArea =
    pathnameNormalized.startsWith("/warden") ||
    pathnameNormalized.startsWith("/dashboard/warden");
  const wantsAdminArea = pathnameNormalized.startsWith("/admin");

  const dashboardByRole = (): string => dashboardPathByRole(userRole);

  if (wantsStudentArea && !isStudentRole(userRole)) {
    return NextResponse.redirect(new URL(dashboardByRole(), request.url));
  }

  if (wantsAdminArea && !isAdminRole(userRole)) {
    return NextResponse.redirect(new URL(dashboardByRole(), request.url));
  }

  if (wantsWardenArea && !isManagementRole(userRole)) {
    return NextResponse.redirect(new URL(dashboardByRole(), request.url));
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
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)",
  ],
};
