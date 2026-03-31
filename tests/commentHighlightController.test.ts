import * as assert from "node:assert/strict";
import test from "node:test";
import type { Comment } from "../src/commentManager";
import { buildPreviewHighlightWraps } from "../src/control/commentHighlightPlanner";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: "comment-1",
        filePath: "note.md",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 4,
        selectedText: "beta",
        selectedTextHash: "hash-beta",
        comment: "note",
        timestamp: 1710000000000,
        resolved: false,
        ...overrides,
    };
}

test("buildPreviewHighlightWraps follows the source occurrence when rendered text repeats", () => {
    const wraps = buildPreviewHighlightWraps(
        "beta one beta",
        0,
        "beta one beta",
        [createComment({
            startChar: 9,
            endChar: 13,
            selectedText: "beta",
        })],
    );

    assert.equal(wraps.length, 1);
    assert.equal(wraps[0].start, 9);
    assert.equal(wraps[0].end, 13);
    assert.equal(wraps[0].comment.id, "comment-1");
});

test("buildPreviewHighlightWraps respects section line offsets for later lines", () => {
    const wraps = buildPreviewHighlightWraps(
        "alpha beta\nsecond beta",
        10,
        "alpha beta\nsecond beta",
        [createComment({
            id: "comment-2",
            startLine: 11,
            startChar: 7,
            endLine: 11,
            endChar: 11,
            selectedText: "beta",
        })],
    );

    assert.equal(wraps.length, 1);
    assert.equal(wraps[0].start, 18);
    assert.equal(wraps[0].end, 22);
    assert.equal(wraps[0].comment.id, "comment-2");
});
