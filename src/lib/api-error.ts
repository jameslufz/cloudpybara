import { NextResponse } from "next/server";
import { InvalidPathError } from "@/lib/storage";

// Turns an error from a storage.ts call into the right HTTP response: a bad
// path is the client's mistake (400), anything else is treated as the
// phone/SFTP connection being unreachable (502).
export function storageErrorResponse(
    error: unknown,
    logContext: string,
): NextResponse {
    if (error instanceof InvalidPathError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(logContext, error);
    return NextResponse.json(
        {
            error: "Could not reach the phone. Check the SFTP settings and that the phone's SFTP server is running.",
        },
        { status: 502 },
    );
}
