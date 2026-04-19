import type { CommentAnchorKind } from "../../commentManager";
import { isOrphanedComment } from "../../core/anchors/commentAnchors";
import { formatFriendlyLocalDateTime } from "../../core/time/dateTime";

export interface SidebarCommentPresentationLike {
    timestamp: number;
    resolved?: boolean;
    anchorKind?: CommentAnchorKind;
    orphaned?: boolean;
    deletedAt?: number;
}

function formatCommentTimestamp(timestamp: number): string {
    return formatFriendlyLocalDateTime(timestamp) ?? "";
}

export function formatSidebarCommentMeta(comment: SidebarCommentPresentationLike): string {
    const segments = [formatCommentTimestamp(comment.timestamp)];

    if (isOrphanedComment(comment)) {
        segments.push("orphaned");
    }
    if (comment.resolved) {
        segments.push("resolved");
    }
    if (comment.deletedAt) {
        segments.push("deleted");
    }

    return segments.join(" · ");
}
