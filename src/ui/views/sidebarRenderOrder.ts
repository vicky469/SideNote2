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

export function sortSidebarRenderableItems(items: readonly SidebarRenderableItem[]): SidebarRenderableItem[] {
    return items.slice().sort((left, right) => {
        const leftComment = left.kind === "thread" ? getSidebarSortCommentForThread(left.thread) : left.draft;
        const rightComment = right.kind === "thread" ? getSidebarSortCommentForThread(right.thread) : right.draft;
        return compareCommentsForSidebarOrder(leftComment, rightComment);
    });
}
