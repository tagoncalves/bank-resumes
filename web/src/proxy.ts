import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME, getTokenFromRequest } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/register", "/api/auth/verify-email"];

function isStaticPath(pathname: string) {
  return pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".");
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api")) {
    return "/dashboard";
  }

  return value;
}

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return redirectToLogin(req);
}

function forbidden(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const token = getTokenFromRequest(req);
    const session = token ? await verifyToken(token) : null;
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL(getSafeRedirectPath(req.nextUrl.searchParams.get("next")), req.url));
    }

    if (token && !session) {
      const res = NextResponse.next();
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    return NextResponse.next();
  }

  const token = getTokenFromRequest(req);

  if (!token) {
    return unauthorized(req);
  }

  const session = await verifyToken(token);

  if (!session) {
    const res = unauthorized(req);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // RBAC: admin-only paths
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  ) {
    if (session.role !== "ADMIN") {
      return forbidden(req);
    }
  }

  // Inject user info into headers for API routes / server components
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-username", session.username);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
