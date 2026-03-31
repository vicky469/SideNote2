import * as assert from "node:assert/strict";
import test from "node:test";
import { RevealedCommentSelectionStore } from "../src/domain/RevealedCommentSelectionStore";

test("revealed comment selection store exposes the active comment id for the matching file", () => {
    const store = new RevealedCommentSelectionStore();

    assert.equal(store.setRevealedCommentState("Folder/Note.md", "comment-1"), true);
    assert.equal(store.getRevealedCommentId("Folder/Note.md"), "comment-1");
    assert.equal(store.getRevealedCommentId("Folder/Other.md"), null);
});

test("revealed comment selection store ignores duplicate selections", () => {
    const store = new RevealedCommentSelectionStore();

    assert.equal(store.setRevealedCommentState("Folder/Note.md", "comment-1"), true);
    assert.equal(store.setRevealedCommentState("Folder/Note.md", "comment-1"), false);
    assert.deepEqual(store.getRevealedCommentState(), {
        filePath: "Folder/Note.md",
        commentId: "comment-1",
    });
});

test("revealed comment selection store clears and returns the previous selection", () => {
    const store = new RevealedCommentSelectionStore();
    store.setRevealedCommentState("Folder/Note.md", "comment-1");

    assert.deepEqual(store.clearRevealedCommentState(), {
        filePath: "Folder/Note.md",
        commentId: "comment-1",
    });
    assert.equal(store.getRevealedCommentState(), null);
    assert.equal(store.getRevealedCommentId("Folder/Note.md"), null);
});
