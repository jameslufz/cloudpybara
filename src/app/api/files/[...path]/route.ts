import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { deleteStoredFile, readStoredFile } from "@/lib/storage";

// Maps a file extension to the content type the browser needs to display
// or play the file correctly, instead of just offering a raw download.
const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".zip": "application/zip",
};

function guessMimeType(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    return MIME_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}

type RouteParams = { params: Promise<{ path: string[] }> };

// A URL like /api/files/Vacation/Day1/beach.jpg gives params.path =
// ["Vacation", "Day1", "beach.jpg"] — everything but the last segment is
// the folder, the last segment is the file name.
function splitFolderAndName(segments: string[]): {
    folder: string;
    name: string;
} {
    const name = segments[segments.length - 1];
    const folder = segments.slice(0, -1).join("/");
    return { folder, name };
}

// GET /api/files/<...path> -> download or view a single file
export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { path: segments } = await params;
    const { folder, name } = splitFolderAndName(segments);

    try {
        const fileData = await readStoredFile(folder, name);

        return new NextResponse(new Uint8Array(fileData), {
            headers: {
                "Content-Type": guessMimeType(name),
                "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
            },
        });
    } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
}

// DELETE /api/files/<...path> -> remove a single file from storage
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const { path: segments } = await params;
    const { folder, name } = splitFolderAndName(segments);

    try {
        await deleteStoredFile(folder, name);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
}
