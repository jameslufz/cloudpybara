import { NextRequest, NextResponse } from "next/server";
import { storageErrorResponse } from "@/lib/api-error";
import { listEntries, saveFile } from "@/lib/storage";

// GET /api/files?folder=Vacation/Day1 -> list entries (files + folders) in that folder
export async function GET(request: NextRequest) {
    const folder = request.nextUrl.searchParams.get("folder") ?? "";

    try {
        const entries = await listEntries(folder);
        return NextResponse.json({ entries });
    } catch (error) {
        return storageErrorResponse(error, "Failed to list files from phone:");
    }
}

// POST /api/files -> upload one or more files (multipart form: "file" fields, optional "folder" field)
export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const uploadedFiles = formData.getAll("file");
    const folder = formData.get("folder");
    const folderPath = typeof folder === "string" ? folder : "";

    if (uploadedFiles.length === 0) {
        return NextResponse.json(
            { error: "No file provided" },
            { status: 400 },
        );
    }

    try {
        for (const uploadedFile of uploadedFiles) {
            if (!(uploadedFile instanceof File)) {
                continue;
            }

            const arrayBuffer = await uploadedFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await saveFile(folderPath, uploadedFile.name, buffer);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return storageErrorResponse(error, "Failed to upload file to phone:");
    }
}
