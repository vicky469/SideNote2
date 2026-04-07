import * as assert from "node:assert/strict";
import test from "node:test";
import { Comment, CommentManager, commentToThread } from "../src/commentManager";

function createComment(id: string, timestamp: number, text: string): Comment {
    return {
        id,
        filePath: "note.md",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 5,
        selectedText: "hello",
        selectedTextHash: "hash",
        comment: text,
        timestamp,
        resolved: false,
    };
}

test("CommentManager edits/deletes/resolves by id under timestamp collision", () => {
    const sameTimestamp = 1710000000000;
    const first = createComment("id-1", sameTimestamp, "first");
    const second = createComment("id-2", sameTimestamp, "second");

    const manager = new CommentManager([first, second]);

    manager.editComment("id-2", "second-updated");
    let comments = manager.getCommentsForFile("note.md");
    assert.equal(comments.find((comment) => comment.id === "id-1")?.comment, "first");
    assert.equal(comments.find((comment) => comment.id === "id-2")?.comment, "second-updated");

    manager.resolveComment("id-1");
    comments = manager.getCommentsForFile("note.md");
    assert.equal(comments.find((comment) => comment.id === "id-1")?.resolved, true);
    assert.equal(comments.find((comment) => comment.id === "id-2")?.resolved, false);

    manager.unresolveComment("id-1");
    comments = manager.getCommentsForFile("note.md");
    assert.equal(comments.find((comment) => comment.id === "id-1")?.resolved, false);

    manager.deleteComment("id-1");
    const remaining = manager.getCommentsForFile("note.md");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "id-2");
});

test("CommentManager targets child thread entries by id", () => {
    const thread = commentToThread(createComment("thread-1", 1710000000000, "parent"));
    thread.entries.push({
        id: "entry-2",
        body: "child",
        timestamp: 1710000001000,
    });

    const manager = new CommentManager([thread]);

    assert.equal(manager.getCommentById("thread-1")?.comment, "parent");
    assert.equal(manager.getCommentById("entry-2")?.comment, "child");

    manager.editComment("entry-2", "child-updated");
    assert.equal(manager.getCommentById("entry-2")?.comment, "child-updated");

    manager.appendEntry("entry-2", {
        id: "entry-3",
        body: "grandchild",
        timestamp: 1710000002000,
    });
    assert.equal(manager.getCommentById("entry-3")?.comment, "grandchild");

    manager.deleteComment("entry-2");
    assert.equal(manager.getCommentById("entry-2"), undefined);
    assert.equal(manager.getThreadById("entry-3")?.entries.length, 2);
});

test("CommentManager preserves a comment when its anchor text is gone", async () => {
    const manager = new CommentManager([
        createComment("id-1", 1710000000000, "first"),
    ]);

    await manager.updateCommentCoordinatesForFile("goodbye", "note.md");

    const remaining = manager.getCommentsForFile("note.md");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "id-1");
    assert.equal(remaining[0].selectedText, "hello");
    assert.equal(remaining[0].orphaned, true);
});

test("CommentManager clears orphaned when the anchor text returns", async () => {
    const manager = new CommentManager([
        {
            ...createComment("id-1", 1710000000000, "first"),
            orphaned: true,
        },
    ]);

    await manager.updateCommentCoordinatesForFile("hello again", "note.md");

    const remaining = manager.getCommentsForFile("note.md");
    assert.equal(remaining[0].orphaned, false);
});
