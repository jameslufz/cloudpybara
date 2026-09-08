import { NextRequest, NextResponse } from "next/server";
import {
    checkCredentials,
    createSessionCookieValue,
    SESSION_COOKIE_NAME,
} from "@/lib/session";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { username, password } = body;

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        !checkCredentials(username, password)
    ) {
        return NextResponse.json(
            { error: "Invalid username or password" },
            { status: 401 },
        );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
}
