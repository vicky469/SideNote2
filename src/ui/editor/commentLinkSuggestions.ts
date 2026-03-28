import type { App, TFile } from "obsidian";

export interface ExistingNoteSuggestion {
    type: "existing";
    file: TFile;
    linkText: string;
}

export interface CreateNoteSuggestion {
    type: "create";
    notePath: string;
    displayName: string;
}

export type SideNoteLinkSuggestion = ExistingNoteSuggestion | CreateNoteSuggestion;

function joinPath(parentPath: string, childPath: string): string {
    if (!parentPath || parentPath === "/") {
        return normalizeNotePath(childPath);
    }

    return normalizeNotePath(`${parentPath}/${childPath}`);
}

function ensureMarkdownExtension(path: string): string {
    return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function extractLinkPath(rawQuery: string): string {
    const aliaslessQuery = rawQuery.split("|")[0]?.trim() ?? "";
    return aliaslessQuery.split("#")[0]?.trim() ?? "";
}

function getFolderPath(path: string): string {
    const slashIndex = path.lastIndexOf("/");
    return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function getMatchScore(query: string, file: TFile, linkText: string): number {
    if (!query) {
        return 100;
    }

    const loweredQuery = query.toLowerCase();
    const basename = file.basename.toLowerCase();
    const path = file.path.toLowerCase();
    const loweredLinkText = linkText.toLowerCase();

    if (basename === loweredQuery || loweredLinkText === loweredQuery || path === `${loweredQuery}.md`) {
        return 0;
    }
    if (basename.startsWith(loweredQuery)) {
        return 1;
    }
    if (loweredLinkText.startsWith(loweredQuery)) {
        return 2;
    }
    if (path.startsWith(loweredQuery)) {
        return 3;
    }
    if (basename.includes(loweredQuery)) {
        return 4;
    }
    if (loweredLinkText.includes(loweredQuery)) {
        return 5;
    }
    if (path.includes(loweredQuery)) {
        return 6;
    }

    return Number.POSITIVE_INFINITY;
}

async function ensureFolderPathExists(app: App, folderPath: string): Promise<void> {
    const normalizedFolderPath = normalizeNotePath(folderPath);
    if (!normalizedFolderPath) {
        return;
    }

    const segments = normalizedFolderPath.split("/").filter(Boolean);
    let currentPath = "";
    for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        const existing = app.vault.getAbstractFileByPath(currentPath);
        if (existing) {
            continue;
        }

        await app.vault.createFolder(currentPath);
    }
}

function resolveNewNotePath(app: App, sourcePath: string, query: string): string | null {
    const linkPath = extractLinkPath(query);
    if (!linkPath) {
        return null;
    }

    const markdownPath = ensureMarkdownExtension(linkPath);
    if (markdownPath.includes("/")) {
        return normalizeNotePath(markdownPath);
    }

    const parentFolder = app.fileManager.getNewFileParent(sourcePath, markdownPath);
    return joinPath(parentFolder.path, markdownPath);
}

function getCreateSuggestion(app: App, sourcePath: string, query: string): CreateNoteSuggestion | null {
    if (!query) {
        return null;
    }

    const notePath = resolveNewNotePath(app, sourcePath, query);
    if (!notePath) {
        return null;
    }

    const exactMatch = app.vault.getAbstractFileByPath(notePath);
    const resolvedMatch = app.metadataCache.getFirstLinkpathDest(query, sourcePath);
    if (exactMatch || resolvedMatch) {
        return null;
    }

    return {
        type: "create",
        notePath,
        displayName: extractLinkPath(query),
    };
}

export function getSideNoteLinkSuggestions(
    app: App,
    query: string,
    sourcePath: string,
    limit = 40,
): SideNoteLinkSuggestion[] {
    const linkPathQuery = extractLinkPath(query);
    const files = app.vault
        .getMarkdownFiles()
        .map((file) => {
            const linkText = app.metadataCache.fileToLinktext(file, sourcePath, true);
            return {
                file,
                linkText,
                score: getMatchScore(linkPathQuery, file, linkText),
            };
        })
        .filter((candidate) => candidate.score !== Number.POSITIVE_INFINITY)
        .sort((left, right) => {
            if (left.score !== right.score) {
                return left.score - right.score;
            }
            if (left.file.basename !== right.file.basename) {
                return left.file.basename.localeCompare(right.file.basename);
            }
            return left.file.path.localeCompare(right.file.path);
        })
        .slice(0, limit)
        .map<ExistingNoteSuggestion>((candidate) => ({
            type: "existing",
            file: candidate.file,
            linkText: candidate.linkText,
        }));

    const createSuggestion = getCreateSuggestion(app, sourcePath, linkPathQuery);
    return createSuggestion ? [createSuggestion, ...files] : files;
}

export async function createSideNoteLinkNote(app: App, notePath: string): Promise<TFile> {
    const folderPath = getFolderPath(notePath);
    await ensureFolderPathExists(app, folderPath);
    return app.vault.create(notePath, "");
}

function normalizeNotePath(path: string): string {
    const isAbsolute = path.startsWith("/");
    const segments = path
        .replace(/\\/g, "/")
        .split("/")
        .filter((segment) => segment.length > 0 && segment !== ".");
    const normalizedSegments: string[] = [];

    for (const segment of segments) {
        if (segment === "..") {
            normalizedSegments.pop();
            continue;
        }

        normalizedSegments.push(segment);
    }

    const normalized = normalizedSegments.join("/");
    return isAbsolute ? `/${normalized}` : normalized;
}
