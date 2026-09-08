"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type StoredEntry = {
    name: string;
    type: "file" | "folder";
    size: number;
    modifiedAt: string;
};

type Tab = "all" | "images" | "files";

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".heic",
    ".bmp",
];

function isImageFile(fileName: string): boolean {
    const lowerCaseName = fileName.toLowerCase();
    return IMAGE_EXTENSIONS.some((extension) =>
        lowerCaseName.endsWith(extension),
    );
}

function buildFileUrl(folder: string, fileName: string): string {
    const filePath = folder === "" ? fileName : `${folder}/${fileName}`;
    return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

function buildFolderDeleteUrl(folder: string, folderName: string): string {
    const folderPath = folder === "" ? folderName : `${folder}/${folderName}`;
    return `/api/folders/${folderPath.split("/").map(encodeURIComponent).join("/")}`;
}

function selectionKey(type: "file" | "folder", name: string): string {
    return `${type}:${name}`;
}

function IconChevronLeft() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}

function IconPlus() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

function IconUpload() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
        </svg>
    );
}

function IconLogout() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
    );
}

function IconFolder() {
    return (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
        </svg>
    );
}

function IconClose() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    );
}

function IconCheckSquare() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    );
}

function IconCheck() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

export default function Home() {
    const router = useRouter();

    const [currentFolder, setCurrentFolder] = useState("");
    const [entries, setEntries] = useState<StoredEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [activeTab, setActiveTab] = useState<Tab>("all");

    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [createFolderError, setCreateFolderError] = useState("");
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [isDeletingSelection, setIsDeletingSelection] = useState(false);

    const [confirmDialog, setConfirmDialog] = useState<{
        message: string;
        onConfirm: () => void;
    } | null>(null);
    const [lightboxFile, setLightboxFile] = useState<{
        name: string;
        url: string;
    } | null>(null);

    function requestConfirm(message: string, onConfirm: () => void) {
        setConfirmDialog({ message, onConfirm });
    }

    // Let Escape close whichever overlay is currently open.
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== "Escape") {
                return;
            }
            setLightboxFile(null);
            setConfirmDialog(null);
            setIsCreateFolderOpen(false);
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    async function loadEntries(folder: string) {
        setIsLoading(true);

        const response = await fetch(
            `/api/files?folder=${encodeURIComponent(folder)}`,
        );

        if (!response.ok) {
            const data = await response.json();
            setErrorMessage(data.error ?? "Could not load files.");
            setIsLoading(false);
            return;
        }

        const data = await response.json();
        setErrorMessage("");
        setEntries(data.entries);
        setIsLoading(false);
    }

    // Fetch the top-level folder once when the page first loads.
    useEffect(() => {
        fetch(`/api/files?folder=`)
            .then(async (response) => {
                const data = await response.json();

                if (!response.ok) {
                    setErrorMessage(data.error ?? "Could not load files.");
                } else {
                    setEntries(data.entries);
                }

                setIsLoading(false);
            })
            .catch(() => {
                setErrorMessage("Could not reach the website's server.");
                setIsLoading(false);
            });
    }, []);

    function openFolder(name: string) {
        const nextFolder =
            currentFolder === "" ? name : `${currentFolder}/${name}`;
        setCurrentFolder(nextFolder);
        loadEntries(nextFolder);
    }

    function goUpOneLevel() {
        const segments = currentFolder.split("/");
        segments.pop();
        const parentFolder = segments.join("/");
        setCurrentFolder(parentFolder);
        loadEntries(parentFolder);
    }

    async function handleFileSelected(
        event: React.ChangeEvent<HTMLInputElement>,
    ) {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        setErrorMessage("");
        setIsUploading(true);

        const formData = new FormData();
        formData.append("folder", currentFolder);
        for (const file of Array.from(selectedFiles)) {
            formData.append("file", file);
        }

        const response = await fetch("/api/files", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            setErrorMessage("Upload failed. Please try again.");
        }

        // Let the user pick the same file again later if they want to.
        event.target.value = "";

        setIsUploading(false);
        await loadEntries(currentFolder);
    }

    function handleDelete(fileName: string) {
        requestConfirm(`Delete "${fileName}"?`, async () => {
            setConfirmDialog(null);
            await fetch(buildFileUrl(currentFolder, fileName), {
                method: "DELETE",
            });
            await loadEntries(currentFolder);
        });
    }

    async function handleCreateFolder(event: React.FormEvent) {
        event.preventDefault();
        setCreateFolderError("");
        setIsCreatingFolder(true);

        const response = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                folder: currentFolder,
                name: newFolderName,
            }),
        });

        setIsCreatingFolder(false);

        if (!response.ok) {
            const data = await response.json();
            setCreateFolderError(data.error ?? "Could not create folder.");
            return;
        }

        setIsCreateFolderOpen(false);
        setNewFolderName("");
        await loadEntries(currentFolder);
    }

    async function handleLogout() {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    }

    function toggleSelected(type: "file" | "folder", name: string) {
        const key = selectionKey(type, name);
        setSelectedKeys((previous) => {
            const next = new Set(previous);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    function exitSelectionMode() {
        setIsSelectionMode(false);
        setSelectedKeys(new Set());
    }

    function handleDeleteSelected() {
        if (selectedKeys.size === 0) {
            return;
        }

        requestConfirm(
            `Delete ${selectedKeys.size} selected item(s)? Deleted files can't be recovered.`,
            async () => {
                setConfirmDialog(null);
                setIsDeletingSelection(true);

                const deletions = [...selectedKeys].map((key) => {
                    const separatorIndex = key.indexOf(":");
                    const type = key.slice(0, separatorIndex);
                    const name = key.slice(separatorIndex + 1);
                    const url =
                        type === "folder"
                            ? buildFolderDeleteUrl(currentFolder, name)
                            : buildFileUrl(currentFolder, name);
                    return fetch(url, { method: "DELETE" });
                });

                await Promise.all(deletions);

                setIsDeletingSelection(false);
                exitSelectionMode();
                await loadEntries(currentFolder);
            },
        );
    }

    const folders = entries.filter((entry) => entry.type === "folder");
    const files = entries.filter((entry) => entry.type === "file");
    const visibleFiles =
        activeTab === "images"
            ? files.filter((file) => isImageFile(file.name))
            : activeTab === "files"
              ? files.filter((file) => !isImageFile(file.name))
              : files;
    const photoFiles = visibleFiles.filter((file) => isImageFile(file.name));
    const otherFiles = visibleFiles.filter((file) => !isImageFile(file.name));

    const pathSegments = currentFolder === "" ? [] : currentFolder.split("/");
    const headerTitle =
        pathSegments.length === 0
            ? "CloudPybara"
            : pathSegments[pathSegments.length - 1];

    return (
        <div className={styles.page}>
            <header className={styles.appBar}>
                {isSelectionMode ? (
                    <button
                        className={styles.iconButton}
                        onClick={exitSelectionMode}
                        aria-label="Cancel selection"
                    >
                        <IconClose />
                    </button>
                ) : pathSegments.length > 0 ? (
                    <button
                        className={styles.iconButton}
                        onClick={goUpOneLevel}
                        aria-label="Back"
                    >
                        <IconChevronLeft />
                    </button>
                ) : (
                    <span className={styles.iconButtonSpacer} />
                )}

                <h1 className={styles.headerTitle}>
                    {isSelectionMode
                        ? `${selectedKeys.size} selected`
                        : headerTitle}
                </h1>

                <div className={styles.headerActions}>
                    {!isSelectionMode && (
                        <button
                            className={styles.iconButton}
                            onClick={() => setIsSelectionMode(true)}
                            aria-label="Select items"
                        >
                            <IconCheckSquare />
                        </button>
                    )}
                    {!isSelectionMode && (
                        <button
                            className={styles.iconButton}
                            onClick={handleLogout}
                            aria-label="Log out"
                        >
                            <IconLogout />
                        </button>
                    )}
                </div>
            </header>

            <main className={styles.content}>
                {!isSelectionMode && (
                    <div className={styles.actionRow}>
                        <label className={styles.uploadButton}>
                            <IconUpload />
                            {isUploading ? "Uploading…" : "Upload photos"}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelected}
                                disabled={isUploading}
                                hidden
                            />
                        </label>
                        <button
                            className={styles.newFolderButton}
                            onClick={() => setIsCreateFolderOpen(true)}
                        >
                            <IconPlus />
                            New folder
                        </button>
                    </div>
                )}

                {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                {isLoading ? (
                    <p className={styles.statusText}>Loading…</p>
                ) : (
                    <>
                        {folders.length > 0 && (
                            <section>
                                <p className={styles.sectionLabel}>โฟลเดอร์</p>
                                <div className={styles.folderGrid}>
                                    {folders.map((folder) => {
                                        const isSelected = selectedKeys.has(
                                            selectionKey("folder", folder.name),
                                        );

                                        return (
                                            <button
                                                key={folder.name}
                                                className={
                                                    isSelected
                                                        ? `${styles.folderCard} ${styles.selected}`
                                                        : styles.folderCard
                                                }
                                                onClick={() =>
                                                    isSelectionMode
                                                        ? toggleSelected(
                                                              "folder",
                                                              folder.name,
                                                          )
                                                        : openFolder(
                                                              folder.name,
                                                          )
                                                }
                                            >
                                                {isSelectionMode && (
                                                    <span
                                                        className={
                                                            isSelected
                                                                ? `${styles.selectionCheck} ${styles.selectionCheckActive}`
                                                                : styles.selectionCheck
                                                        }
                                                    >
                                                        {isSelected && (
                                                            <IconCheck />
                                                        )}
                                                    </span>
                                                )}
                                                <IconFolder />
                                                <span
                                                    className={
                                                        styles.folderName
                                                    }
                                                >
                                                    {folder.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {photoFiles.length === 0 && otherFiles.length === 0 ? (
                            <p className={styles.statusText}>
                                {folders.length === 0
                                    ? "No files yet. Upload something to get started."
                                    : "No files in this view."}
                            </p>
                        ) : (
                            <>
                                {photoFiles.length > 0 && (
                                    <section>
                                        <p className={styles.sectionLabel}>
                                            รูปภาพ
                                        </p>
                                        <ul className={styles.photoGrid}>
                                            {photoFiles.map((file) => {
                                                const fileUrl = buildFileUrl(
                                                    currentFolder,
                                                    file.name,
                                                );
                                                const isSelected =
                                                    selectedKeys.has(
                                                        selectionKey(
                                                            "file",
                                                            file.name,
                                                        ),
                                                    );

                                                return (
                                                    <li
                                                        key={file.name}
                                                        className={
                                                            isSelected
                                                                ? `${styles.photoCard} ${styles.selected}`
                                                                : styles.photoCard
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                isSelectionMode
                                                            ) {
                                                                toggleSelected(
                                                                    "file",
                                                                    file.name,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <div
                                                            className={
                                                                styles.photoThumbnailWrap
                                                            }
                                                        >
                                                            <a
                                                                href={fileUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={(
                                                                    event,
                                                                ) => {
                                                                    event.preventDefault();
                                                                    // In selection mode, let the click
                                                                    // bubble up to the <li>'s handler,
                                                                    // which does the actual toggle —
                                                                    // toggling here too would flip it
                                                                    // right back.
                                                                    if (
                                                                        !isSelectionMode
                                                                    ) {
                                                                        setLightboxFile(
                                                                            {
                                                                                name: file.name,
                                                                                url: fileUrl,
                                                                            },
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                {/* Plain <img>, not next/image: these
                                                                    come from our own API route, and
                                                                    next/image needs either a static
                                                                    import or a configured remote loader
                                                                    for dynamic sources — not worth the
                                                                    setup here. */}
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={
                                                                        fileUrl
                                                                    }
                                                                    alt={
                                                                        file.name
                                                                    }
                                                                    className={
                                                                        styles.photoThumbnail
                                                                    }
                                                                />
                                                            </a>
                                                            <span
                                                                className={
                                                                    styles.sizeBadge
                                                                }
                                                            >
                                                                {formatFileSize(
                                                                    file.size,
                                                                )}
                                                            </span>
                                                            {isSelectionMode ? (
                                                                <span
                                                                    className={
                                                                        isSelected
                                                                            ? `${styles.selectionCheck} ${styles.selectionCheckActive}`
                                                                            : styles.selectionCheck
                                                                    }
                                                                >
                                                                    {isSelected && (
                                                                        <IconCheck />
                                                                    )}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() =>
                                                                        handleDelete(
                                                                            file.name,
                                                                        )
                                                                    }
                                                                    className={
                                                                        styles.photoDeleteButton
                                                                    }
                                                                    aria-label={`Delete ${file.name}`}
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span
                                                            className={
                                                                styles.photoName
                                                            }
                                                        >
                                                            {file.name}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                )}

                                {otherFiles.length > 0 && (
                                    <section>
                                        <p className={styles.sectionLabel}>
                                            ไฟล์
                                        </p>
                                        <ul className={styles.fileList}>
                                            {otherFiles.map((file) => {
                                                const fileUrl = buildFileUrl(
                                                    currentFolder,
                                                    file.name,
                                                );
                                                const isSelected =
                                                    selectedKeys.has(
                                                        selectionKey(
                                                            "file",
                                                            file.name,
                                                        ),
                                                    );

                                                return (
                                                    <li
                                                        key={file.name}
                                                        className={
                                                            isSelected
                                                                ? `${styles.fileRow} ${styles.selected}`
                                                                : styles.fileRow
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                isSelectionMode
                                                            ) {
                                                                toggleSelected(
                                                                    "file",
                                                                    file.name,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <a
                                                            href={fileUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className={
                                                                styles.fileName
                                                            }
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                if (
                                                                    isSelectionMode
                                                                ) {
                                                                    event.preventDefault();
                                                                }
                                                            }}
                                                        >
                                                            {file.name}
                                                        </a>
                                                        <span
                                                            className={
                                                                styles.fileSize
                                                            }
                                                        >
                                                            {formatFileSize(
                                                                file.size,
                                                            )}
                                                        </span>
                                                        {isSelectionMode ? (
                                                            <span
                                                                className={
                                                                    isSelected
                                                                        ? `${styles.selectionCheck} ${styles.selectionCheckActive}`
                                                                        : styles.selectionCheck
                                                                }
                                                            >
                                                                {isSelected && (
                                                                    <IconCheck />
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        file.name,
                                                                    )
                                                                }
                                                                className={
                                                                    styles.deleteButton
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                )}
                            </>
                        )}
                    </>
                )}
            </main>

            {isSelectionMode ? (
                <div className={styles.selectionBar}>
                    <button
                        className={styles.selectionCancelButton}
                        onClick={exitSelectionMode}
                    >
                        ยกเลิก
                    </button>
                    <span className={styles.selectionCount}>
                        {selectedKeys.size} รายการ
                    </span>
                    <button
                        className={styles.selectionDeleteButton}
                        onClick={handleDeleteSelected}
                        disabled={
                            selectedKeys.size === 0 || isDeletingSelection
                        }
                    >
                        {isDeletingSelection ? "กำลังลบ…" : "ลบ"}
                    </button>
                </div>
            ) : (
                <nav className={styles.tabBar}>
                    <button
                        className={
                            activeTab === "all"
                                ? styles.tabButtonActive
                                : styles.tabButton
                        }
                        onClick={() => setActiveTab("all")}
                    >
                        ทั้งหมด
                    </button>
                    <button
                        className={
                            activeTab === "images"
                                ? styles.tabButtonActive
                                : styles.tabButton
                        }
                        onClick={() => setActiveTab("images")}
                    >
                        รูปภาพ
                    </button>
                    <button
                        className={
                            activeTab === "files"
                                ? styles.tabButtonActive
                                : styles.tabButton
                        }
                        onClick={() => setActiveTab("files")}
                    >
                        ไฟล์
                    </button>
                </nav>
            )}

            {isCreateFolderOpen && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setIsCreateFolderOpen(false)}
                >
                    <form
                        className={styles.modalCard}
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={handleCreateFolder}
                    >
                        <h2 className={styles.modalTitle}>New folder</h2>
                        <input
                            type="text"
                            className={styles.modalInput}
                            value={newFolderName}
                            onChange={(event) =>
                                setNewFolderName(event.target.value)
                            }
                            placeholder="Folder name"
                            autoFocus
                            required
                        />
                        {createFolderError && (
                            <p className={styles.error}>{createFolderError}</p>
                        )}
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.modalCancelButton}
                                onClick={() => setIsCreateFolderOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={styles.modalCreateButton}
                                disabled={isCreatingFolder}
                            >
                                {isCreatingFolder ? "Creating…" : "Create"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {confirmDialog && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setConfirmDialog(null)}
                >
                    <div
                        className={styles.modalCard}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <p className={styles.confirmMessage}>
                            {confirmDialog.message}
                        </p>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.modalCancelButton}
                                onClick={() => setConfirmDialog(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.modalDeleteButton}
                                onClick={confirmDialog.onConfirm}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {lightboxFile && (
                <div
                    className={styles.lightboxOverlay}
                    onClick={() => setLightboxFile(null)}
                >
                    <button
                        className={styles.lightboxCloseButton}
                        onClick={() => setLightboxFile(null)}
                        aria-label="Close"
                    >
                        <IconClose />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={lightboxFile.url}
                        alt={lightboxFile.name}
                        className={styles.lightboxImage}
                        onClick={(event) => event.stopPropagation()}
                    />
                    <span className={styles.lightboxCaption}>
                        {lightboxFile.name}
                    </span>
                </div>
            )}
        </div>
    );
}
