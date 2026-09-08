import { NextRequest, NextResponse } from "next/server";
import { storageErrorResponse } from "@/lib/api-error";
import { deleteFolder } from "@/lib/storage";

type RouteParams = { params: Promise<{ path: string[] }> };

// DELETE /api/folders/<...path> -> "delete" a folder (moves it into a
// hidden trash folder — see the TRASH_FOLDER_NAME comment in storage.ts)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const { path: segments } = await params;
    const name = segments[segments.length - 1];
    const folder = segments.slice(0, -1).join("/");

    try {
        await deleteFolder(folder, name);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return storageErrorResponse(error, "Failed to delete folder on phone:");
    }
}
