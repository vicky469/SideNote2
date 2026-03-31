import type { Comment } from "../../commentManager";
import { extractTagsFromText } from "../../core/text/commentTags";
import type { DraftComment } from "../../domain/drafts";
import type { TextEditResult } from "../editor/commentEditorFormatting";
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

export interface SidebarDraftEditorHost {
    getAllIndexedComments(): Comment[];
    updateDraftCommentText(commentId: string, commentText: string): void;
    renderComments(): Promise<void>;
    scheduleDraftFocus(commentId: string): void;
    openLinkSuggestModal(options: LinkSuggestCallbacks): void;
    openTagSuggestModal(options: TagSuggestCallbacks): void;
}

export function getSidebarComments(
    persistedComments: Comment[],
    draftComment: DraftComment | null,
    showResolved: boolean,
): Array<Comment | DraftComment> {
    const commentsWithoutDraft = draftComment
        ? persistedComments.filter((comment) => comment.id !== draftComment.id)
        : persistedComments.slice();
    const visibleComments = showResolved
        ? commentsWithoutDraft
        : commentsWithoutDraft.filter((comment) => !comment.resolved);
    const mergedComments = draftComment
        ? visibleComments.concat(draftComment)
        : visibleComments;

    return mergedComments
        .slice()
        .sort((left, right) => {
            if (left.filePath !== right.filePath) {
                return left.filePath.localeCompare(right.filePath);
            }
            if (left.startLine !== right.startLine) {
                return left.startLine - right.startLine;
            }
            if (left.startChar !== right.startChar) {
                return left.startChar - right.startChar;
            }
            return left.timestamp - right.timestamp;
        }) as Array<Comment | DraftComment>;
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

    constructor(private readonly host: SidebarDraftEditorHost) {}

    public shouldSaveDraftFromEnter(event: KeyboardEvent): boolean {
        return event.key === "Enter"
            && !event.shiftKey
            && !event.altKey
            && !event.isComposing;
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
