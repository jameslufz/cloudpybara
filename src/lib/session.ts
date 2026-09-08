import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "session";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "SESSION_SECRET is not set. Add a long random value for it to .env.local.",
        );
    }

    return secret;
}

function sign(expiresAt: number): string {
    return createHmac("sha256", getSessionSecret())
        .update(String(expiresAt))
        .digest("hex");
}

export function checkCredentials(username: string, password: string): boolean {
    return (
        username === process.env.AUTH_USER &&
        password === process.env.AUTH_PASSWORD
    );
}

// A session cookie is just an expiry timestamp plus an HMAC signature of
// that timestamp — no server-side session storage needed, and it survives
// server restarts (unlike an in-memory token list would).
export function createSessionCookieValue(): string {
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionCookieValue(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    const [expiresAtText, signature] = value.split(".");
    if (!expiresAtText || !signature) {
        return false;
    }

    const expiresAt = Number(expiresAtText);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return false;
    }

    const expectedSignature = Buffer.from(sign(expiresAt));
    const actualSignature = Buffer.from(signature);

    if (expectedSignature.length !== actualSignature.length) {
        return false;
    }

    return timingSafeEqual(expectedSignature, actualSignature);
}
