import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const publicRoutes = ["/login", "/register"];
  const isPublicRoute = publicRoutes.some((route) => path === route || path.startsWith(`${route}/`));

  const sessionToken = request.cookies.get("session_id")?.value;
  const hasValidSessionToken = Boolean(sessionToken && sessionToken !== "null" && sessionToken !== "undefined");

  if (!isPublicRoute && !hasValidSessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
