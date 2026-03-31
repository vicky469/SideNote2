import * as assert from "node:assert/strict";
import test from "node:test";
import type { Comment } from "../src/commentManager";
import { buildAttachmentComments, parseAttachmentComments } from "../src/core/storage/attachmentCommentStorage";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: "comment-1",
        filePath: "docs/paper.pdf",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "paper",
        selectedTextHash: "hash-1",
        comment: "A PDF page note.",
        timestamp: 1710000000000,
        anchorKind: "page",
        orphaned: false,
        resolved: false,
        ...overrides,
    };
}

test("attachment comment storage only persists PDF page notes", () => {
    const stored = buildAttachmentComments([
        createComment({ id: "pdf-page" }),
        createComment({
            id: "pdf-selection",
            anchorKind: "selection",
            selectedText: "selection",
        }),
        createComment({
            id: "md-page",
            filePath: "notes/tmp.md",
        }),
    ]);

    assert.deepEqual(stored, [{
        id: "pdf-page",
        filePath: "docs/paper.pdf",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "paper",
        selectedTextHash: "hash-1",
        comment: "A PDF page note.",
        timestamp: 1710000000000,
        anchorKind: "page",
        resolved: undefined,
    }]);
});

test("attachment comment storage round-trips stored PDF page notes", () => {
    const parsed = parseAttachmentComments([{
        id: "pdf-page",
        filePath: "docs/paper.pdf",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "paper",
        selectedTextHash: "hash-1",
        comment: "Line one\r\nLine two\n\n",
        timestamp: 1710000000000,
        anchorKind: "page",
        resolved: true,
    }, {
        id: "invalid-docx",
        filePath: "docs/report.docx",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "report",
        selectedTextHash: "hash-2",
        comment: "Should be skipped",
        timestamp: 1710000000001,
        anchorKind: "page",
    }]);

    assert.deepEqual(parsed, [{
        id: "pdf-page",
        filePath: "docs/paper.pdf",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "paper",
        selectedTextHash: "hash-1",
        comment: "Line one\nLine two",
        timestamp: 1710000000000,
        anchorKind: "page",
        orphaned: false,
        resolved: true,
    }]);
});
