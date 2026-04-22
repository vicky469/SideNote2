import {
    type App,
    SuggestModal,
} from "obsidian";
import type { SideNoteReferenceSearchDocument } from "../../index/SideNoteReferenceSearchIndex";

interface SideNoteReferenceSuggestModalOptions {
    emptyStateText?: string;
    excludeThreadId?: string | null;
    initialQuery: string;
    onChooseReference: (commentId: string) => void | Promise<void>;
    onCloseModal: () => void;
    placeholder?: string;
    searchReferences: (query: string, options: {
        excludeThreadId?: string | null;
        limit?: number;
    }) => SideNoteReferenceSearchDocument[];
    sourcePath: string;
    title?: string;
}

export default class SideNoteReferenceSuggestModal extends SuggestModal<SideNoteReferenceSearchDocument> {
    private readonly emptyStateTextOverride: string;
    private readonly excludeThreadId: string | null;
    private readonly initialQuery: string;
    private readonly onChooseReference: (commentId: string) => void | Promise<void>;
    private readonly onCloseModal: () => void;
    private readonly placeholder: string;
    private readonly searchReferences: SideNoteReferenceSuggestModalOptions["searchReferences"];
    private readonly sourcePath: string;
    private readonly title: string;

    constructor(app: App, options: SideNoteReferenceSuggestModalOptions) {
        super(app);
        this.emptyStateTextOverride = options.emptyStateText ?? "No indexed side notes match that query.";
        this.excludeThreadId = options.excludeThreadId ?? null;
        this.initialQuery = options.initialQuery;
        this.onChooseReference = options.onChooseReference;
        this.onCloseModal = options.onCloseModal;
        this.placeholder = options.placeholder ?? "Find a side note to reference";
        this.searchReferences = options.searchReferences;
        this.sourcePath = options.sourcePath;
        this.title = options.title ?? "Link side note";

        this.limit = 40;
        this.setPlaceholder(this.placeholder);
        this.emptyStateText = this.emptyStateTextOverride;
        this.setInstructions([
            { command: "↑↓", purpose: "move" },
            { command: "Enter", purpose: "choose" },
            { command: "Esc", purpose: "cancel" },
        ]);
    }

    onOpen(): void {
        void super.onOpen();
        this.setTitle(this.title);
        this.inputEl.value = this.initialQuery;
        this.inputEl.dispatchEvent(new Event("input"));
        const caret = this.inputEl.value.length;
        this.inputEl.setSelectionRange(caret, caret);
    }

    onClose(): void {
        super.onClose();
        this.onCloseModal();
    }

    getSuggestions(query: string): SideNoteReferenceSearchDocument[] {
        return this.searchReferences(query, {
            excludeThreadId: this.excludeThreadId,
            limit: this.limit,
        }).filter((suggestion) => suggestion.filePath !== this.sourcePath || suggestion.threadId !== this.excludeThreadId);
    }

    renderSuggestion(suggestion: SideNoteReferenceSearchDocument, el: HTMLElement): void {
        const titleEl = el.createDiv();
        const noteEl = el.createDiv({ cls: "sidenote2-link-suggest-note" });

        titleEl.setText(suggestion.primaryLabel);
        noteEl.setText(
            suggestion.bodyPreview
                ? `${suggestion.filePath} · ${suggestion.bodyPreview}`
                : suggestion.filePath,
        );
    }

    onChooseSuggestion(suggestion: SideNoteReferenceSearchDocument): void {
        void this.onChooseReference(suggestion.commentId);
    }
}
