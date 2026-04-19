import type { CommentAnchorKind } from "../../commentManager";
import * as momentNamespace from "moment";
import { isOrphanedComment } from "../../core/anchors/commentAnchors";

const moment = ((momentNamespace as { default?: unknown }).default ?? momentNamespace) as typeof import("moment");

export interface SidebarCommentPresentationLike {
    timestamp: number;
    resolved?: boolean;
    anchorKind?: CommentAnchorKind;
    orphaned?: boolean;
    deletedAt?: number;
    selectedText?: string;
}

export function formatSidebarCommentTimestamp(
    timestamp: number,
    referenceNow: number = Date.now(),
): string {
    const date = moment(timestamp);
    if (!date.isValid()) {
        return "";
    }

    const now = moment(referenceNow);
    return date.calendar(now, {
        sameDay: "LT",
        lastDay: "[Yesterday]",
        lastWeek: "ddd LT",
        nextDay: "LT",
        nextWeek: "ddd LT",
        sameElse: date.isSame(now, "year") ? "MMM D" : "YYYY-MM-DD",
    });
}

export function formatSidebarCommentSelectedTextPreview(
    comment: Pick<SidebarCommentPresentationLike, "anchorKind" | "selectedText">,
): string | null {
    if (comment.anchorKind !== "selection" || typeof comment.selectedText !== "string") {
        return null;
    }

    const normalized = comment.selectedText.replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : null;
}

export function formatSidebarCommentMeta(comment: SidebarCommentPresentationLike): string {
    const segments = [formatSidebarCommentTimestamp(comment.timestamp)];

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
