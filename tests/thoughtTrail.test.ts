import * as assert from "node:assert/strict";
import test from "node:test";
import { buildThoughtTrailLines } from "../src/core/derived/thoughtTrail";
import type { Comment } from "../src/commentManager";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "file1.md",
        startLine: overrides.startLine ?? 0,
        startChar: overrides.startChar ?? 0,
        endLine: overrides.endLine ?? 0,
        endChar: overrides.endChar ?? 5,
        selectedText: overrides.selectedText ?? "hello",
        selectedTextHash: overrides.selectedTextHash ?? "hash-1",
        comment: overrides.comment ?? "",
        timestamp: overrides.timestamp ?? 1710000000000,
        resolved: overrides.resolved ?? false,
        anchorKind: overrides.anchorKind ?? "selection",
        orphaned: overrides.orphaned ?? false,
    };
}

test("buildThoughtTrailLines renders nested thought trails from wiki links", () => {
    const lines = buildThoughtTrailLines("dev", [
        createComment({
            id: "root-note",
            filePath: "file1.md",
            selectedText: "setup",
            comment: "See [[file3]] and [[file2]].",
        }),
        createComment({
            id: "deep-note",
            filePath: "file3.md",
            selectedText: "internals",
            comment: "Continue to [[file4]].",
        }),
    ], {
        resolveWikiLinkPath: (linkPath) => `${linkPath}.md`,
    });

    assert.deepEqual(lines, [
        "- **file1.md**",
        "  - [setup · file3](obsidian://side-note2-comment?vault=dev&file=file1.md&commentId=root-note) -> **file3.md**",
        "    - [internals · file4](obsidian://side-note2-comment?vault=dev&file=file3.md&commentId=deep-note) -> **file4.md**",
        "  - [setup · file2](obsidian://side-note2-comment?vault=dev&file=file1.md&commentId=root-note) -> **file2.md**",
    ]);
});

test("buildThoughtTrailLines returns no rows when nothing connects", () => {
    const lines = buildThoughtTrailLines("dev", [
        createComment({
            filePath: "file1.md",
            selectedText: "setup",
            comment: "No links here.",
        }),
    ], {
        resolveWikiLinkPath: (linkPath) => `${linkPath}.md`,
    });

    assert.deepEqual(lines, []);
});

test("buildThoughtTrailLines marks cycles and avoids duplicate roots", () => {
    const lines = buildThoughtTrailLines("dev", [
        createComment({
            id: "note-a",
            filePath: "file1.md",
            selectedText: "alpha",
            comment: "Go to [[file2]].",
        }),
        createComment({
            id: "note-b",
            filePath: "file2.md",
            selectedText: "beta",
            comment: "Return to [[file1]].",
        }),
    ], {
        resolveWikiLinkPath: (linkPath) => `${linkPath}.md`,
    });

    assert.equal(lines[0], "- **file1.md**");
    assert.equal(lines[1], "  - [alpha · file2](obsidian://side-note2-comment?vault=dev&file=file1.md&commentId=note-a) -> **file2.md**");
    assert.equal(lines[2], "    - [beta · file1](obsidian://side-note2-comment?vault=dev&file=file2.md&commentId=note-b) -> **file1.md** (cycle)");
    assert.equal(lines.includes("- **file2.md**"), false);
});
