import type { Comment } from "../../commentManager";
import { isPageComment } from "../anchors/commentAnchors";
import { isAttachmentCommentablePath } from "../rules/commentableFiles";

interface StoredAttachmentComment {
    id: string;
    filePath: string;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    selectedText: string;
    selectedTextHash: string;
    comment: string;
    timestamp: number;
    anchorKind?: "page";
    resolved?: boolean;
}

function normalizeCommentBody(body: string): string {
    return body.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function toStoredAttachmentComment(comment: Comment): StoredAttachmentComment {
    return {
        id: comment.id,
        filePath: comment.filePath,
        startLine: comment.startLine,
        startChar: comment.startChar,
        endLine: comment.endLine,
        endChar: comment.endChar,
        selectedText: comment.selectedText,
        selectedTextHash: comment.selectedTextHash,
        comment: comment.comment,
        timestamp: comment.timestamp,
        anchorKind: "page",
        resolved: comment.resolved === true ? true : undefined,
    };
}

function fromStoredAttachmentComment(candidate: unknown): Comment | null {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }

    const item = candidate as Partial<StoredAttachmentComment>;
    if (
        typeof item.id !== "string" ||
        typeof item.filePath !== "string" ||
        typeof item.startLine !== "number" ||
        typeof item.startChar !== "number" ||
        typeof item.endLine !== "number" ||
        typeof item.endChar !== "number" ||
        typeof item.selectedText !== "string" ||
        typeof item.selectedTextHash !== "string" ||
        typeof item.comment !== "string" ||
        typeof item.timestamp !== "number"
    ) {
        return null;
    }

    if (!isAttachmentCommentablePath(item.filePath)) {
        return null;
    }

    return {
        id: item.id,
        filePath: item.filePath,
        startLine: item.startLine,
        startChar: item.startChar,
        endLine: item.endLine,
        endChar: item.endChar,
        selectedText: item.selectedText,
        selectedTextHash: item.selectedTextHash,
        comment: normalizeCommentBody(item.comment),
        timestamp: item.timestamp,
        anchorKind: "page",
        orphaned: false,
        resolved: item.resolved === true,
    };
}

export function parseAttachmentComments(value: unknown): Comment[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => fromStoredAttachmentComment(item))
        .filter((comment): comment is Comment => comment !== null)
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
        });
}

export function buildAttachmentComments(comments: Comment[]): StoredAttachmentComment[] {
    return comments
        .filter((comment) => isAttachmentCommentablePath(comment.filePath) && isPageComment(comment))
        .sort((left, right) => {
            if (left.filePath !== right.filePath) {
                return left.filePath.localeCompare(right.filePath);
            }

            return left.timestamp - right.timestamp;
        })
        .map((comment) => toStoredAttachmentComment(comment));
}
