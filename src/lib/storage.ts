import { readFileSync } from "fs";
import SftpClient from "ssh2-sftp-client";

// Connection details for the phone's SFTP server (e.g. Primitive FTPd).
// The website itself does not store any files locally — every read/write
// goes over the network to the phone.
const SFTP_HOST = process.env.SFTP_HOST ?? "";
const SFTP_PORT = Number(process.env.SFTP_PORT ?? 2222);
const SFTP_USERNAME = process.env.SFTP_USERNAME ?? "";

// Either a password or a private key file can be used to log in. A private
// key is more secure, but a password is quicker to set up, so both are
// supported — the key wins if both happen to be set.
const SFTP_PASSWORD = process.env.SFTP_PASSWORD ?? "";
const SFTP_PRIVATE_KEY_PATH = process.env.SFTP_PRIVATE_KEY_PATH ?? "";

// Folder on the phone where files live. Create this folder on the phone
// yourself first (e.g. with a file manager) before starting the site. No
// leading slash by default — see the note in .env.example.
const REMOTE_DIR = process.env.SFTP_REMOTE_DIR ?? "PhoneCloud";

// Some SFTP servers (Primitive FTPd included) don't implement the SFTP
// "remove directory" operation, so a folder can't actually be removed.
// Instead, "deleting" a folder renames it in here, out of sight of normal
// browsing. It still takes up space on the phone.
const TRASH_FOLDER_NAME = ".trash";

export type StoredEntry = {
    name: string;
    type: "file" | "folder";
    size: number;
    modifiedAt: string;
};

export class FolderAlreadyExistsError extends Error {
    constructor(name: string) {
        super(`Folder "${name}" already exists`);
        this.name = "FolderAlreadyExistsError";
    }
}

// Runs one action against the phone, opening a fresh SFTP connection for it
// and always closing that connection afterwards.
async function withSftpConnection<T>(
    action: (client: SftpClient) => Promise<T>,
): Promise<T> {
    const client = new SftpClient();

    try {
        await client.connect({
            host: SFTP_HOST,
            port: SFTP_PORT,
            username: SFTP_USERNAME,
            // Fail fast instead of hanging for a long time when SFTP_HOST is
            // wrong or the phone's SFTP server isn't running.
            readyTimeout: 8000,
            ...(SFTP_PRIVATE_KEY_PATH
                ? {
                      privateKey: readFileSync(
                          /* turbopackIgnore: true */ SFTP_PRIVATE_KEY_PATH,
                      ),
                  }
                : { password: SFTP_PASSWORD }),
        });

        return await action(client);
    } finally {
        await client.end();
    }
}

// Thrown for a malformed/unsafe path — a client mistake, not a phone
// connectivity problem, so routes should turn this into a 400, not a 502.
export class InvalidPathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidPathError";
    }
}

// A single path segment (a folder name or a file name) coming from the
// outside — the upload form, or a URL. Never trust it directly, or someone
// could smuggle in "..", a slash, or a null byte to escape REMOTE_DIR.
const INVALID_PATH_SEGMENT_PATTERN = /[\\/\0]/;

function assertSafePathSegment(segment: string): void {
    if (segment === "" || segment === "." || segment === "..") {
        throw new InvalidPathError(`Invalid path segment: "${segment}"`);
    }
    if (INVALID_PATH_SEGMENT_PATTERN.test(segment)) {
        throw new InvalidPathError(`Invalid path segment: "${segment}"`);
    }
}

// Turns a folder path (e.g. "Vacation/Day1", or "" for the top level) and an
// optional file/folder name into a full path on the phone, rejecting
// anything that looks like an attempt to escape REMOTE_DIR.
export function resolveRemotePath(folderPath: string, name?: string): string {
    if (folderPath.startsWith("/")) {
        throw new InvalidPathError(
            "Folder path must be relative (no leading slash)",
        );
    }

    const trimmedPath = folderPath.replace(/\/+$/, "");
    const segments = trimmedPath === "" ? [] : trimmedPath.split("/");

    for (const segment of segments) {
        assertSafePathSegment(segment);
    }

    if (name !== undefined) {
        assertSafePathSegment(name);
        segments.push(name);
    }

    return [REMOTE_DIR, ...segments].join("/");
}

export async function listEntries(folderPath: string): Promise<StoredEntry[]> {
    return withSftpConnection(async (client) => {
        const remoteDir = resolveRemotePath(folderPath);
        const rawEntries = await client.list(remoteDir);
        const entries: StoredEntry[] = [];

        for (const entry of rawEntries) {
            if (entry.type !== "-" && entry.type !== "d") {
                continue; // skip symlinks and anything unusual
            }

            if (folderPath === "" && entry.name === TRASH_FOLDER_NAME) {
                continue; // hide the trash folder from normal browsing
            }

            entries.push({
                name: entry.name,
                type: entry.type === "d" ? "folder" : "file",
                // Some SFTP servers (e.g. Primitive FTPd) don't report a
                // size for directories.
                size: entry.size ?? 0,
                modifiedAt: new Date(entry.modifyTime).toISOString(),
            });
        }

        // Newest first, within each type (folders/files are separated by the caller).
        entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

        return entries;
    });
}

export async function createFolder(
    folderPath: string,
    name: string,
): Promise<void> {
    await withSftpConnection(async (client) => {
        const targetPath = resolveRemotePath(folderPath, name);

        if (await client.exists(targetPath)) {
            throw new FolderAlreadyExistsError(name);
        }

        await client.mkdir(targetPath, false);
    });
}

// See the TRASH_FOLDER_NAME comment above: this moves the folder (and
// everything inside it) out of view rather than truly deleting it, since
// the phone's SFTP server doesn't support removing directories.
export async function deleteFolder(
    folderPath: string,
    name: string,
): Promise<void> {
    await withSftpConnection(async (client) => {
        const sourcePath = resolveRemotePath(folderPath, name);
        const trashDir = resolveRemotePath("", TRASH_FOLDER_NAME);

        if (!(await client.exists(trashDir))) {
            await client.mkdir(trashDir, false);
        }

        const trashPath = resolveRemotePath(
            TRASH_FOLDER_NAME,
            `${Date.now()}-${name}`,
        );
        await client.rename(sourcePath, trashPath);
    });
}

export async function saveFile(
    folderPath: string,
    name: string,
    data: Buffer,
): Promise<void> {
    await withSftpConnection(async (client) => {
        await client.put(data, resolveRemotePath(folderPath, name));
    });
}

export async function readStoredFile(
    folderPath: string,
    name: string,
): Promise<Buffer> {
    return withSftpConnection(async (client) => {
        // Without a destination argument, client.get() always resolves to a
        // Buffer of the file's contents (the string/stream cases only happen
        // when a destination path or stream is passed in, which we never do).
        const result = await client.get(resolveRemotePath(folderPath, name));

        if (!Buffer.isBuffer(result)) {
            throw new Error("Expected file contents as a Buffer");
        }

        return result;
    });
}

export async function deleteStoredFile(
    folderPath: string,
    name: string,
): Promise<void> {
    await withSftpConnection(async (client) => {
        await client.delete(resolveRemotePath(folderPath, name));
    });
}
