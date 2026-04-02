import { App, SuggestModal, setIcon } from "obsidian";
import {
    getIndexFileFilterFileName,
    getIndexFileFilterSuggestions,
    normalizeIndexFileFilterPaths,
    type IndexFileFilterOption,
} from "../views/indexFileFilter";

interface SideNoteFileFilterModalOptions {
    availableOptions: IndexFileFilterOption[];
    selectedFilePaths: string[];
    onChangeSelection: (selectedFilePaths: string[]) => void | Promise<void>;
    onCloseModal?: () => void;
}

function formatCommentCount(commentCount: number): string {
    return commentCount === 1 ? "1 side note" : `${commentCount} side notes`;
}

export default class SideNoteFileFilterModal extends SuggestModal<IndexFileFilterOption> {
    private readonly availableOptions: IndexFileFilterOption[];
    private selectedFilePaths: string[];
    private readonly onChangeSelection: (selectedFilePaths: string[]) => void | Promise<void>;
    private readonly onCloseModal?: () => void;

    constructor(app: App, options: SideNoteFileFilterModalOptions) {
        super(app);
        this.availableOptions = options.availableOptions;
        this.selectedFilePaths = normalizeIndexFileFilterPaths(options.selectedFilePaths);
        this.onChangeSelection = options.onChangeSelection;
        this.onCloseModal = options.onCloseModal;

        this.limit = Math.max(this.availableOptions.length, 40);
        this.setPlaceholder("Search files");
        this.emptyStateText = this.availableOptions.length
            ? "No matching files with side notes."
            : "No files with side notes yet.";
        this.setInstructions([
            { command: "↑↓", purpose: "move" },
            { command: "Enter", purpose: "toggle" },
            { command: "Esc", purpose: "close" },
        ]);
    }

    onOpen(): void {
        super.onOpen();
        this.setTitle("Filter by files");
    }

    onClose(): void {
        super.onClose();
        this.onCloseModal?.();
    }

    getSuggestions(query: string): IndexFileFilterOption[] {
        return getIndexFileFilterSuggestions(
            this.availableOptions,
            query,
            this.selectedFilePaths,
            this.limit,
        );
    }

    renderSuggestion(option: IndexFileFilterOption, el: HTMLElement): void {
        const isSelected = this.selectedFilePaths.includes(option.filePath);
        el.addClass("sidenote2-file-filter-suggestion");
        if (isSelected) {
            el.addClass("is-selected");
        }

        const contentEl = el.createDiv("sidenote2-file-filter-suggestion-main");
        contentEl.createDiv({
            text: getIndexFileFilterFileName(option.filePath),
            cls: "sidenote2-file-filter-suggestion-title",
        });
        contentEl.createDiv({
            text: `${option.filePath} · ${formatCommentCount(option.commentCount)}`,
            cls: "sidenote2-file-filter-note",
        });

        const statusEl = el.createSpan("sidenote2-file-filter-suggestion-status");
        if (isSelected) {
            setIcon(statusEl, "check");
        }
    }

    public selectSuggestion(value: IndexFileFilterOption, evt: MouseEvent | KeyboardEvent): void {
        evt.preventDefault();
        evt.stopPropagation();
        void this.toggleFile(value.filePath);
    }

    async onChooseSuggestion(): Promise<void> {
        await Promise.resolve();
    }

    private async toggleFile(filePath: string): Promise<void> {
        const isSelected = this.selectedFilePaths.includes(filePath);
        this.selectedFilePaths = isSelected
            ? this.selectedFilePaths.filter((path) => path !== filePath)
            : normalizeIndexFileFilterPaths([...this.selectedFilePaths, filePath]);

        await this.onChangeSelection(this.selectedFilePaths.slice());
        this.refreshSuggestions();
    }

    private refreshSuggestions(): void {
        this.inputEl.dispatchEvent(new Event("input"));
        window.setTimeout(() => {
            this.inputEl.focus();
        }, 0);
    }
}
