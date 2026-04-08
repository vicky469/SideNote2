import * as assert from "node:assert/strict";
import test from "node:test";
import { commentToThread, type Comment } from "../src/commentManager";
import type { SidebarRenderableItem } from "../src/ui/views/sidebarRenderOrder";
import { getSidebarSortCommentForThread, sortSidebarRenderableItems } from "../src/ui/views/sidebarRenderOrder";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "docs/note.md",
        startLine: overrides.startLine ?? 0,
        startChar: overrides.startChar ?? 0,
        endLine: overrides.endLine ?? 0,
        endChar: overrides.endChar ?? 0,
        selectedText: overrides.selectedText ?? "note",
        selectedTextHash: overrides.selectedTextHash ?? "hash:note",
        comment: overrides.comment ?? "Comment body",
        timestamp: overrides.timestamp ?? 100,
        anchorKind: overrides.anchorKind ?? "page",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
    };
}

test("getSidebarSortCommentForThread keeps the parent entry timestamp for threaded sorting", () => {
    const thread = commentToThread(createComment({
        id: "page-note-1",
        timestamp: 100,
    }));
    thread.entries.push({
        id: "reply-1",
        body: "Later reply",
        timestamp: 300,
    });
    thread.updatedAt = 300;

    const sortComment = getSidebarSortCommentForThread(thread);

    assert.equal(sortComment.id, "page-note-1");
    assert.equal(sortComment.timestamp, 100);
    assert.equal(sortComment.comment, "Comment body");
});

test("sortSidebarRenderableItems keeps page-note thread order stable after later replies", () => {
    const olderPageThread = commentToThread(createComment({
        id: "page-note-older",
        timestamp: 100,
    }));
    olderPageThread.entries.push({
        id: "reply-1",
        body: "Second child reply",
        timestamp: 400,
    });
    olderPageThread.updatedAt = 400;

    const newerPageThread = commentToThread(createComment({
        id: "page-note-newer",
        timestamp: 200,
    }));

    const items: SidebarRenderableItem[] = [
        { kind: "thread", thread: newerPageThread },
        { kind: "thread", thread: olderPageThread },
    ];
    const sorted = sortSidebarRenderableItems(items);

    assert.deepEqual(sorted.map((item) => item.kind === "thread" ? item.thread.id : item.draft.id), [
        "page-note-older",
        "page-note-newer",
    ]);
});
