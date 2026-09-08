import { NextRequest, NextResponse } from "next/server";
import { storageErrorResponse } from "@/lib/api-error";
import { createFolder, FolderAlreadyExistsError } from "@/lib/storage";

// POST /api/folders -> create a new folder. Body: { folder: string (parent path), name: string }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { folder, name } = body;

    const folderPath = typeof folder === "string" ? folder : "";

    if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
            { error: "Folder name is required" },
            { status: 400 },
        );
    }

    try {
        await createFolder(folderPath, name);
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof FolderAlreadyExistsError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        return storageErrorResponse(error, "Failed to create folder on phone:");
    }
}
