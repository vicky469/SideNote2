import * as assert from "node:assert/strict";
import test from "node:test";
import type { CommentThread } from "../src/commentManager";
import { buildSideNoteReferenceIndex } from "../src/core/derived/sideNoteReferenceIndex";
import { buildSideNoteReferenceUrl } from "../src/core/text/commentReferences";
import { AggregateCommentIndex } from "../src/index/AggregateCommentIndex";

function createThread(overrides: Partial<CommentThread> = {}): CommentThread {
    return {
        id: overrides.id ?? "thread-1",
        filePath: overrides.filePath ?? "docs/a.md",
        startLine: overrides.startLine ?? 0,
        startChar: overrides.startChar ?? 0,
        endLine: overrides.endLine ?? 0,
        endChar: overrides.endChar ?? 0,
        selectedText: overrides.selectedText ?? "selection",
        selectedTextHash: overrides.selectedTextHash ?? "hash:selection",
        anchorKind: overrides.anchorKind ?? "selection",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
        entries: overrides.entries ?? [{
            id: overrides.id ?? "thread-1",
            body: "",
            timestamp: overrides.createdAt ?? 100,
        }],
        createdAt: overrides.createdAt ?? 100,
        updatedAt: overrides.updatedAt ?? 200,
    };
}

test("buildSideNoteReferenceIndex resolves incoming links and excludes same-file references from graph edges", () => {
    const aggregateCommentIndex = new AggregateCommentIndex();
    const localVaultName = "Dev";
    const sameFileUrl = buildSideNoteReferenceUrl(localVaultName, {
        commentId: "thread-d",
        filePath: "docs/a.md",
    });
    const crossFileUrl = buildSideNoteReferenceUrl(localVaultName, {
        commentId: "thread-b",
        filePath: "docs/b.md",
    });
    const childEntryUrl = buildSideNoteReferenceUrl(localVaultName, {
        commentId: "entry-c2",
        filePath: "docs/c.md",
    });

    aggregateCommentIndex.updateFile("docs/a.md", [
        createThread({
            id: "thread-a",
            filePath: "docs/a.md",
            entries: [{
                id: "entry-a1",
                body: [
                    `[Same file](${sameFileUrl})`,
                    `[Cross file](${crossFileUrl})`,
                    `[Cross file dup](${crossFileUrl})`,
                    `[Child entry](${childEntryUrl})`,
                ].join(" "),
                timestamp: 100,
            }],
        }),
        createThread({
            id: "thread-d",
            filePath: "docs/a.md",
            selectedText: "same-file target",
            entries: [{ id: "thread-d", body: "", timestamp: 110 }],
        }),
    ]);
    aggregateCommentIndex.updateFile("docs/b.md", [
        createThread({
            id: "thread-b",
            filePath: "docs/b.md",
            selectedText: "cross-file target",
            entries: [{ id: "thread-b", body: "", timestamp: 120 }],
        }),
    ]);
    aggregateCommentIndex.updateFile("docs/c.md", [
        createThread({
            id: "thread-c",
            filePath: "docs/c.md",
            selectedText: "child target",
            entries: [
                { id: "thread-c", body: "", timestamp: 130 },
                { id: "entry-c2", body: "", timestamp: 140 },
            ],
        }),
    ]);

    const index = buildSideNoteReferenceIndex(aggregateCommentIndex, {
        allCommentsNotePath: "SideNote2 index.md",
        localVaultName,
    });

    assert.equal(index.outgoingByThreadId.get("thread-a")?.length, 3);
    assert.equal(index.incomingByThreadId.get("thread-b")?.[0]?.sourceThreadId, "thread-a");
    assert.equal(index.incomingByThreadId.get("thread-c")?.[0]?.targetThreadId, "thread-c");
    assert.deepEqual(
        Array.from(index.crossFileOutgoingAdjacency.get("docs/a.md") ?? []).sort(),
        ["docs/b.md", "docs/c.md"],
    );
});
