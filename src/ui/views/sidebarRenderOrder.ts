import type { Comment, CommentThread } from "../../commentManager";
import { getFirstThreadEntry, threadEntryToComment } from "../../commentManager";
import { compareCommentsForSidebarOrder } from "../../core/anchors/commentSectionOrder";
import type { DraftComment } from "../../domain/drafts";

export type SidebarRenderableItem =
    | { kind: "thread"; thread: CommentThread }
    | { kind: "draft"; draft: DraftComment };

export function getSidebarSortCommentForThread(thread: CommentThread): Comment {
    const firstEntry = getFirstThreadEntry(thread);

    return {
        ...threadEntryToComment(thread, firstEntry),
        id: thread.id,
    };
}

export function getReplacedThreadIdForEditDraft(
    threads: readonly CommentThread[],
    draft: DraftComment | null,
): string | null {
    if (!draft || draft.mode !== "edit") {
        return null;
    }

    if (draft.threadId) {
        return draft.threadId;
    }

    return threads.find((thread) =>
        thread.id === draft.id || thread.entries.some((entry) => entry.id === draft.id)
    )?.id ?? draft.id;
}

export function sortSidebarRenderableItems(items: readonly SidebarRenderableItem[]): SidebarRenderableItem[] {
    return items.slice().sort((left, right) => {
        const leftComment = left.kind === "thread" ? getSidebarSortCommentForThread(left.thread) : left.draft;
        const rightComment = right.kind === "thread" ? getSidebarSortCommentForThread(right.thread) : right.draft;
        return compareCommentsForSidebarOrder(leftComment, rightComment);
    });
}
