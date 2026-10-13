import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// WARNING: routes added here MUST also be added to the matcher config below
// Search routes (hoteles, vuelos) are intentionally NOT protected — the API
// does not require authentication for public search (see Backend docs).
// /busqueda-ai is intentionally NOT protected — anonymous users can access
// AI-powered search (same as /vuelos and /hoteles). The backend API does not
// require authentication for public search (see Backend docs).
const PROTECTED_ROUTES = [
  "/perfil",
  "/documentos",
  "/favoritos",
  "/compras",
  "/checkout",
  "/confirmacion",
  "/admin",
];

const AUTH_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/resend-verification",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken =
    request.cookies.get("__Secure-access_token")?.value ||
    request.cookies.get("access_token")?.value ||
    "";
  const refreshToken =
    request.cookies.get("__Secure-refresh_token")?.value ||
    request.cookies.get("refresh_token")?.value ||
    "";
  const isAuthenticated = !!(accessToken || refreshToken);

  const hasSessionExpired =
    request.nextUrl.searchParams.get("reason") === "session_expired";

  // Redirect authenticated users away from auth pages (unless their session
  // is known to be broken — prevents infinite refresh loop when AuthContext
  // redirects to /auth/login?reason=session_expired).
  if (
    isAuthenticated &&
    AUTH_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    if (hasSessionExpired) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect authenticated routes: redirect unauthenticated users to login
  // and preserve the intended destination as returnUrl.
  if (
    !isAuthenticated &&
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    const returnUrl = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(
      new URL(`/auth/login?returnUrl=${returnUrl}`, request.url)
    );
  }

  // Hide password-reset pages when the feature flag is off
  if (process.env.NEXT_PUBLIC_FEATURE_PASSWORD_RESET !== "true") {
    if (
      pathname.startsWith("/auth/forgot-password") ||
      pathname.startsWith("/auth/reset-password")
    ) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/perfil/:path*",
    "/documentos/:path*",
    "/busqueda-ai/:path*",
    "/favoritos/:path*",
    "/compras/:path*",
    "/checkout/:path*",
    "/confirmacion/:path*",
    "/admin/:path*",
    "/hoteles/:path*",
    "/vuelos/:path*",
  ],
};
