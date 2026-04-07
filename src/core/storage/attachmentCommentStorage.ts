import type { Comment, CommentThread, CommentThreadEntry } from "../../commentManager";
import { commentToThread, threadToComment, cloneCommentThread } from "../../commentManager";
import { isPageComment } from "../anchors/commentAnchors";
import { isAttachmentCommentablePath } from "../rules/commentableFiles";

interface StoredAttachmentCommentThreadEntry {
    id: string;
    body: string;
    timestamp: number;
}

interface StoredAttachmentCommentThread {
    id: string;
    filePath: string;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    selectedText: string;
    selectedTextHash: string;
    entries: StoredAttachmentCommentThreadEntry[];
    createdAt: number;
    updatedAt: number;
    anchorKind?: "page";
    resolved?: boolean;
}

function normalizeCommentBody(body: string): string {
    return body.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function toStoredEntry(entry: CommentThreadEntry): StoredAttachmentCommentThreadEntry {
    return {
        id: entry.id,
        body: normalizeCommentBody(entry.body),
        timestamp: entry.timestamp,
    };
}

function toStoredAttachmentThread(thread: CommentThread): StoredAttachmentCommentThread {
    return {
        id: thread.id,
        filePath: thread.filePath,
        startLine: thread.startLine,
        startChar: thread.startChar,
        endLine: thread.endLine,
        endChar: thread.endChar,
        selectedText: thread.selectedText,
        selectedTextHash: thread.selectedTextHash,
        entries: thread.entries.map((entry) => toStoredEntry(entry)),
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        anchorKind: "page",
        resolved: thread.resolved === true ? true : undefined,
    };
}

function fromStoredEntry(candidate: unknown): CommentThreadEntry | null {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }

    const item = candidate as Partial<StoredAttachmentCommentThreadEntry>;
    if (
        typeof item.id !== "string"
        || typeof item.body !== "string"
        || typeof item.timestamp !== "number"
    ) {
        return null;
    }

    return {
        id: item.id,
        body: normalizeCommentBody(item.body),
        timestamp: item.timestamp,
    };
}

function fromStoredAttachmentThread(candidate: unknown): CommentThread | null {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }

    const item = candidate as Partial<StoredAttachmentCommentThread>;
    if (
        typeof item.id !== "string"
        || typeof item.filePath !== "string"
        || typeof item.startLine !== "number"
        || typeof item.startChar !== "number"
        || typeof item.endLine !== "number"
        || typeof item.endChar !== "number"
        || typeof item.selectedText !== "string"
        || typeof item.selectedTextHash !== "string"
        || !Array.isArray(item.entries)
        || item.entries.length === 0
        || typeof item.createdAt !== "number"
        || typeof item.updatedAt !== "number"
    ) {
        return null;
    }

    if (!isAttachmentCommentablePath(item.filePath)) {
        return null;
    }

    const entries = item.entries
        .map((entry) => fromStoredEntry(entry))
        .filter((entry): entry is CommentThreadEntry => entry !== null);
    if (!entries.length) {
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
        entries,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        anchorKind: "page",
        orphaned: false,
        resolved: item.resolved === true,
    };
}

export function parseAttachmentCommentThreads(value: unknown): CommentThread[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => fromStoredAttachmentThread(item))
        .filter((thread): thread is CommentThread => thread !== null)
        .sort((left, right) => {
            if (left.filePath !== right.filePath) {
                return left.filePath.localeCompare(right.filePath);
            }

            return left.createdAt - right.createdAt;
        })
        .map((thread) => cloneCommentThread(thread));
}

export function buildAttachmentCommentThreads(threads: CommentThread[]): StoredAttachmentCommentThread[] {
    return threads
        .filter((thread) => isAttachmentCommentablePath(thread.filePath) && isPageComment(thread))
        .sort((left, right) => {
            if (left.filePath !== right.filePath) {
                return left.filePath.localeCompare(right.filePath);
            }

            return left.createdAt - right.createdAt;
        })
        .map((thread) => toStoredAttachmentThread(thread));
}

export function parseAttachmentComments(value: unknown): Comment[] {
    return parseAttachmentCommentThreads(value).map((thread) => threadToComment(thread));
}

export function buildAttachmentComments(comments: Comment[]): StoredAttachmentCommentThread[] {
    return buildAttachmentCommentThreads(comments.map((comment) => commentToThread(comment)));
}
