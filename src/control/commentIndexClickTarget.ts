import { parseCommentLocationUrl } from "../core/derived/allCommentsNote";

export interface IndexLivePreviewClickTarget {
    kind: "comment";
    commentId: string;
    filePath: string;
}

export interface ClosestLookupTarget {
    closest(selector: string): {
        dataset?: Record<string, string | undefined>;
        getAttribute(name: string): string | null;
    } | null;
}

const INDEX_NATIVE_COLLAPSE_CONTROL_SELECTOR = [
    ".heading-collapse-indicator",
    ".collapse-indicator",
    ".collapse-icon",
    ".cm-fold-indicator",
].join(", ");

export function isIndexNativeCollapseControlTarget(target: ClosestLookupTarget | null): boolean {
    return !!target?.closest(INDEX_NATIVE_COLLAPSE_CONTROL_SELECTOR);
}

export function findClickedIndexLivePreviewTarget(
    target: ClosestLookupTarget | null,
): IndexLivePreviewClickTarget | null {
    if (!target) {
        return null;
    }

    if (isIndexNativeCollapseControlTarget(target)) {
        return null;
    }

    const commentLink = target.closest("a.sidenote2-index-comment-link[data-sidenote2-comment-url]");
    const commentUrl = commentLink?.dataset?.sidenote2CommentUrl ?? "";
    const commentTarget = commentUrl ? parseCommentLocationUrl(commentUrl) : null;
    if (commentTarget) {
        return {
            kind: "comment",
            ...commentTarget,
        };
    }

    return null;
}
