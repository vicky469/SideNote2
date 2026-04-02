import type { Hotkey } from "obsidian";
import type { Comment } from "../../commentManager";
import { compareCommentsForSidebarOrder } from "../../core/anchors/commentSectionOrder";
import { extractTagsFromText } from "../../core/text/commentTags";
import type { DraftComment } from "../../domain/drafts";
import { toggleMarkdownHighlight, type TextEditResult } from "../editor/commentEditorFormatting";
import { findOpenWikiLinkQuery, replaceOpenWikiLinkQuery } from "../editor/commentEditorLinks";
import { findOpenTagQuery, replaceOpenTagQuery } from "../editor/commentEditorTags";

type LinkSuggestCallbacks = {
    initialQuery: string;
    sourcePath: string;
    onChooseLink: (linkText: string) => Promise<void>;
    onCloseModal: () => void;
};

type TagSuggestCallbacks = {
    extraTags: string[];
    initialQuery: string;
    onChooseTag: (tagText: string) => Promise<void>;
    onCloseModal: () => void;
};

type KeyboardHotkeyEventLike = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "isComposing" | "key" | "metaKey" | "shiftKey">;
export const DEFAULT_HIGHLIGHT_HOTKEY: Hotkey = {
    modifiers: ["Alt"],
    key: "H",
};

export interface SidebarDraftEditorHost {
    getAllIndexedComments(): Comment[];
    updateDraftCommentText(commentId: string, commentText: string): void;
    renderComments(): Promise<void>;
    scheduleDraftFocus(commentId: string): void;
    openLinkSuggestModal(options: LinkSuggestCallbacks): void;
    openTagSuggestModal(options: TagSuggestCallbacks): void;
}

function isHotkeyModifierList(value: unknown): value is Hotkey["modifiers"] {
    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((modifier) => (
        modifier === "Mod"
        || modifier === "Ctrl"
        || modifier === "Meta"
        || modifier === "Shift"
        || modifier === "Alt"
    ));
}

function isHotkey(value: unknown): value is Hotkey {
    if (!value || typeof value !== "object") {
        return false;
    }

    const hotkey = value as Partial<Hotkey>;
    return isHotkeyModifierList(hotkey.modifiers)
        && typeof hotkey.key === "string"
        && hotkey.key.trim().length > 0;
}

export function resolveHighlightHotkeysFromConfig(rawValue: unknown): Hotkey[] {
    if (!Array.isArray(rawValue)) {
        return [DEFAULT_HIGHLIGHT_HOTKEY];
    }

    const hotkeys = rawValue
        .filter(isHotkey)
        .map((hotkey) => ({
            modifiers: hotkey.modifiers.slice(),
            key: hotkey.key,
        }));

    return hotkeys.length > 0 ? hotkeys : [DEFAULT_HIGHLIGHT_HOTKEY];
}

function normalizeHotkeyKey(key: string): string {
    return key.length === 1 ? key.toUpperCase() : key;
}

function defaultIsMacOS(): boolean {
    return typeof navigator !== "undefined"
        && typeof navigator.platform === "string"
        && navigator.platform.toLowerCase().includes("mac");
}

export function eventMatchesHotkey(
    event: KeyboardHotkeyEventLike,
    hotkey: Hotkey,
    isMacOS: boolean = defaultIsMacOS(),
): boolean {
    if (event.isComposing) {
        return false;
    }

    const expectsMod = hotkey.modifiers.includes("Mod");
    const expectsCtrl = hotkey.modifiers.includes("Ctrl");
    const expectsMeta = hotkey.modifiers.includes("Meta");
    const expectedCtrl = expectsCtrl || (expectsMod && !isMacOS);
    const expectedMeta = expectsMeta || (expectsMod && isMacOS);

    if (event.ctrlKey !== expectedCtrl) {
        return false;
    }
    if (event.metaKey !== expectedMeta) {
        return false;
    }
    if (event.altKey !== hotkey.modifiers.includes("Alt")) {
        return false;
    }
    if (event.shiftKey !== hotkey.modifiers.includes("Shift")) {
        return false;
    }

    return normalizeHotkeyKey(event.key) === normalizeHotkeyKey(hotkey.key);
}

export function getSidebarComments(
    persistedComments: Comment[],
    draftComment: DraftComment | null,
    showResolved: boolean,
    selectedFilePaths: readonly string[] = [],
): Array<Comment | DraftComment> {
    const selectedFileSet = selectedFilePaths.length
        ? new Set(selectedFilePaths)
        : null;
    const commentsWithoutDraft = draftComment
        ? persistedComments.filter((comment) => comment.id !== draftComment.id)
        : persistedComments.slice();
    const fileScopedComments = selectedFileSet
        ? commentsWithoutDraft.filter((comment) => selectedFileSet.has(comment.filePath))
        : commentsWithoutDraft;
    const visibleComments = showResolved
        ? fileScopedComments
        : fileScopedComments.filter((comment) => !comment.resolved);
    const visibleDraft = !draftComment || !selectedFileSet || selectedFileSet.has(draftComment.filePath)
        ? draftComment
        : null;
    const mergedComments = visibleDraft
        ? visibleComments.concat(visibleDraft)
        : visibleComments;

    return mergedComments
        .slice()
        .sort(compareCommentsForSidebarOrder) as Array<Comment | DraftComment>;
}

export function estimateDraftTextareaRows(commentText: string, isEditMode: boolean): number {
    const minRows = isEditMode ? 6 : 4;
    const maxRows = isEditMode ? 18 : 10;
    const approximateCharsPerRow = 48;
    const lines = commentText.split("\n");
    const estimatedRows = lines.reduce((total, line) => (
        total + Math.max(1, Math.ceil(Math.max(line.length, 1) / approximateCharsPerRow))
    ), 0);

    return Math.min(maxRows, Math.max(minRows, estimatedRows));
}

export class SidebarDraftEditorController {
    private activeInlineSuggest: "link" | "tag" | null = null;
    private highlightHotkeys: Hotkey[] = [DEFAULT_HIGHLIGHT_HOTKEY];

    constructor(
        private readonly host: SidebarDraftEditorHost,
        private readonly loadHighlightHotkeys: () => Promise<Hotkey[]> = async () => [DEFAULT_HIGHLIGHT_HOTKEY],
    ) {}

    public async refreshFormattingHotkeys(): Promise<void> {
        try {
            this.highlightHotkeys = await this.loadHighlightHotkeys();
        } catch (error) {
            console.warn("Failed to refresh SideNote2 draft editor formatting hotkeys", error);
            this.highlightHotkeys = [DEFAULT_HIGHLIGHT_HOTKEY];
        }
    }

    public shouldSaveDraftFromEnter(event: KeyboardEvent): boolean {
        return event.key === "Enter"
            && !event.shiftKey
            && !event.altKey
            && !event.isComposing;
    }

    public toggleDraftHighlight(
        event: KeyboardEvent,
        commentId: string,
        textarea: HTMLTextAreaElement,
        isEditMode: boolean,
    ): boolean {
        if (!this.highlightHotkeys.some((hotkey) => eventMatchesHotkey(event, hotkey))) {
            return false;
        }

        const edit = toggleMarkdownHighlight(
            textarea.value,
            textarea.selectionStart,
            textarea.selectionEnd,
        );
        this.applyDraftEditorEdit(commentId, textarea, edit, isEditMode);
        return true;
    }

    public openDraftLinkSuggest(
        comment: DraftComment,
        textarea: HTMLTextAreaElement,
        isEditMode: boolean,
    ): boolean {
        if (this.activeInlineSuggest) {
            return false;
        }

        const linkQuery = findOpenWikiLinkQuery(
            textarea.value,
            textarea.selectionStart,
            textarea.selectionEnd,
        );
        if (!linkQuery) {
            return false;
        }

        const initialValue = textarea.value;
        const initialCursor = linkQuery.end;
        let inserted = false;
        this.activeInlineSuggest = "link";

        this.host.openLinkSuggestModal({
            initialQuery: linkQuery.query,
            sourcePath: comment.filePath,
            onChooseLink: async (linkText) => {
                inserted = true;
                const edit = replaceOpenWikiLinkQuery(initialValue, linkQuery, linkText);
                if (textarea.isConnected) {
                    this.applyDraftEditorEdit(comment.id, textarea, edit, isEditMode);
                    textarea.focus();
                    return;
                }

                this.host.updateDraftCommentText(comment.id, edit.value);
                await this.host.renderComments();
                this.host.scheduleDraftFocus(comment.id);
            },
            onCloseModal: () => {
                this.activeInlineSuggest = null;
                if (inserted || !textarea.isConnected) {
                    return;
                }

                window.requestAnimationFrame(() => {
                    textarea.focus();
                    textarea.setSelectionRange(initialCursor, initialCursor);
                });
            },
        });

        return true;
    }

    public openDraftTagSuggest(
        comment: DraftComment,
        textarea: HTMLTextAreaElement,
        isEditMode: boolean,
    ): boolean {
        if (this.activeInlineSuggest || findOpenWikiLinkQuery(
            textarea.value,
            textarea.selectionStart,
            textarea.selectionEnd,
        )) {
            return false;
        }

        const tagQuery = findOpenTagQuery(
            textarea.value,
            textarea.selectionStart,
            textarea.selectionEnd,
        );
        if (!tagQuery) {
            return false;
        }

        const initialValue = textarea.value;
        const initialCursor = tagQuery.end;
        let inserted = false;
        this.activeInlineSuggest = "tag";

        this.host.openTagSuggestModal({
            extraTags: [
                ...this.host.getAllIndexedComments().flatMap((storedComment) => extractTagsFromText(storedComment.comment ?? "")),
                ...extractTagsFromText(textarea.value),
            ],
            initialQuery: tagQuery.query,
            onChooseTag: async (tagText) => {
                inserted = true;
                const edit = replaceOpenTagQuery(initialValue, tagQuery, tagText);
                if (textarea.isConnected) {
                    this.applyDraftEditorEdit(comment.id, textarea, edit, isEditMode);
                    textarea.focus();
                    return;
                }

                this.host.updateDraftCommentText(comment.id, edit.value);
                await this.host.renderComments();
                this.host.scheduleDraftFocus(comment.id);
            },
            onCloseModal: () => {
                this.activeInlineSuggest = null;
                if (inserted || !textarea.isConnected) {
                    return;
                }

                window.requestAnimationFrame(() => {
                    textarea.focus();
                    textarea.setSelectionRange(initialCursor, initialCursor);
                });
            },
        });

        return true;
    }

    private applyDraftEditorEdit(
        commentId: string,
        textarea: HTMLTextAreaElement,
        edit: TextEditResult,
        isEditMode: boolean,
    ): void {
        textarea.value = edit.value;
        textarea.rows = estimateDraftTextareaRows(edit.value, isEditMode);
        textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        this.host.updateDraftCommentText(commentId, edit.value);
    }
}
