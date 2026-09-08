import { NextRequest, NextResponse } from "next/server";
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";

// Routes reachable without a valid session — just the login page and the
// endpoint that creates one.
const PUBLIC_PATHS = ["/login", "/api/login"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (PUBLIC_PATHS.includes(pathname)) {
        return NextResponse.next();
    }

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (isValidSessionCookieValue(sessionCookie)) {
        return NextResponse.next();
    }

    // API routes get a plain 401 (the page's own fetch calls handle this);
    // page routes get sent to the login page.
    if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
}

// Protect every page and API route, but not static assets (CSS/JS chunks,
// images, favicon) — those must load even before a session cookie exists,
// or the login page itself renders unstyled.
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
