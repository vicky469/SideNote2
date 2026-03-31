import type { CommentAnchorKind } from "../../commentManager";
import { isOrphanedComment } from "../../core/anchors/commentAnchors";
import {
    COMMENT_SECTION_DEFINITIONS,
    getCommentSectionKey,
    type CommentSectionKey,
} from "../../core/anchors/commentSectionOrder";

export type SidebarSectionKey = CommentSectionKey;

export interface SidebarCommentPresentationLike {
    timestamp: number;
    resolved?: boolean;
    anchorKind?: CommentAnchorKind;
    orphaned?: boolean;
}

export interface SidebarSection<T> {
    key: SidebarSectionKey;
    title: string;
    comments: T[];
}

function formatCommentTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatSidebarCommentMeta(comment: SidebarCommentPresentationLike): string {
    const segments = [formatCommentTimestamp(comment.timestamp)];

    if (isOrphanedComment(comment)) {
        segments.push("orphaned");
    }
    if (comment.resolved) {
        segments.push("resolved");
    }

    return segments.join(" · ");
}

export const getSidebarSectionKey = getCommentSectionKey;

export function buildSidebarSections<T extends SidebarCommentPresentationLike>(comments: T[]): SidebarSection<T>[] {
    return COMMENT_SECTION_DEFINITIONS.map((section) => ({
        key: section.key,
        title: section.title,
        comments: comments.filter((comment) => getSidebarSectionKey(comment) === section.key),
    }));
}
