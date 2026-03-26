import {
    type App,
    Notice,
    SuggestModal,
    TFile,
    normalizePath,
    parseLinktext,
} from "obsidian";

interface ExistingNoteSuggestion {
    type: "existing";
    file: TFile;
    linkText: string;
}

interface CreateNoteSuggestion {
    type: "create";
    notePath: string;
    displayName: string;
}

type SideNoteLinkSuggestion = ExistingNoteSuggestion | CreateNoteSuggestion;

interface SideNoteLinkSuggestModalOptions {
    initialQuery: string;
    sourcePath: string;
    onChooseLink: (linkText: string) => void | Promise<void>;
    onCloseModal: () => void;
}

function joinPath(parentPath: string, childPath: string): string {
    if (!parentPath || parentPath === "/") {
        return normalizePath(childPath);
    }

    return normalizePath(`${parentPath}/${childPath}`);
}

function ensureMarkdownExtension(path: string): string {
    return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function extractLinkPath(rawQuery: string): string {
    const aliaslessQuery = rawQuery.split("|")[0]?.trim() ?? "";
    const { path } = parseLinktext(aliaslessQuery);
    return path.trim();
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
    const normalizedFolderPath = normalizePath(folderPath);
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

export default class SideNoteLinkSuggestModal extends SuggestModal<SideNoteLinkSuggestion> {
    private readonly initialQuery: string;
    private readonly sourcePath: string;
    private readonly onChooseLink: (linkText: string) => void | Promise<void>;
    private readonly onCloseModal: () => void;

    constructor(app: App, options: SideNoteLinkSuggestModalOptions) {
        super(app);
        this.initialQuery = options.initialQuery;
        this.sourcePath = options.sourcePath;
        this.onChooseLink = options.onChooseLink;
        this.onCloseModal = options.onCloseModal;

        this.setPlaceholder("Link or create a note");
        this.emptyStateText = "Type a note name to create a new markdown file.";
        this.setInstructions([
            { command: "↑↓", purpose: "move" },
            { command: "Enter", purpose: "choose" },
            { command: "Esc", purpose: "cancel" },
        ]);
    }

    onOpen(): void {
        super.onOpen();
        this.setTitle("Insert note link");
        this.inputEl.value = this.initialQuery;
        this.inputEl.dispatchEvent(new Event("input"));
        const caret = this.inputEl.value.length;
        this.inputEl.setSelectionRange(caret, caret);
    }

    onClose(): void {
        super.onClose();
        this.onCloseModal();
    }

    getSuggestions(query: string): SideNoteLinkSuggestion[] {
        const linkPathQuery = extractLinkPath(query);
        const files = this.app.vault
            .getMarkdownFiles()
            .map((file) => ({
                file,
                linkText: this.app.metadataCache.fileToLinktext(file, this.sourcePath, true),
                score: getMatchScore(linkPathQuery, file, this.app.metadataCache.fileToLinktext(file, this.sourcePath, true)),
            }))
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
            .slice(0, 40)
            .map<ExistingNoteSuggestion>((candidate) => ({
                type: "existing",
                file: candidate.file,
                linkText: candidate.linkText,
            }));

        const createSuggestion = this.getCreateSuggestion(linkPathQuery);
        return createSuggestion ? [createSuggestion, ...files] : files;
    }

    renderSuggestion(suggestion: SideNoteLinkSuggestion, el: HTMLElement): void {
        const titleEl = el.createDiv();
        const noteEl = el.createDiv({ cls: "sidenote2-link-suggest-note" });

        if (suggestion.type === "create") {
            titleEl.setText(`Create note: ${suggestion.displayName}`);
            noteEl.setText(suggestion.notePath);
            return;
        }

        titleEl.setText(suggestion.file.basename);
        noteEl.setText(suggestion.file.path);
    }

    async onChooseSuggestion(suggestion: SideNoteLinkSuggestion): Promise<void> {
        if (suggestion.type === "existing") {
            await this.onChooseLink(`[[${suggestion.linkText}]]`);
            return;
        }

        try {
            const file = await this.createNote(suggestion.notePath);
            const linkText = this.app.metadataCache.fileToLinktext(file, this.sourcePath, true);
            await this.onChooseLink(`[[${linkText}]]`);
            new Notice(`Created ${file.basename}`);
        } catch (error) {
            console.error("Failed to create linked note", error);
            new Notice("Failed to create note.");
        }
    }

    private getCreateSuggestion(query: string): CreateNoteSuggestion | null {
        if (!query) {
            return null;
        }

        const notePath = this.resolveNewNotePath(query);
        if (!notePath) {
            return null;
        }

        const exactMatch = this.app.vault.getAbstractFileByPath(notePath);
        const resolvedMatch = this.app.metadataCache.getFirstLinkpathDest(query, this.sourcePath);
        if (exactMatch instanceof TFile || resolvedMatch) {
            return null;
        }

        return {
            type: "create",
            notePath,
            displayName: query,
        };
    }

    private resolveNewNotePath(query: string): string | null {
        const linkPath = extractLinkPath(query);
        if (!linkPath) {
            return null;
        }

        const markdownPath = ensureMarkdownExtension(linkPath);
        if (markdownPath.includes("/")) {
            return normalizePath(markdownPath);
        }

        const parentFolder = this.app.fileManager.getNewFileParent(this.sourcePath, markdownPath);
        return joinPath(parentFolder.path, markdownPath);
    }

    private async createNote(notePath: string): Promise<TFile> {
        const folderPath = getFolderPath(notePath);
        await ensureFolderPathExists(this.app, folderPath);
        return this.app.vault.create(notePath, "");
    }
}
