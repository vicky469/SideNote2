import * as assert from "node:assert/strict";
import test from "node:test";
import { decideEditDismissal } from "../src/ui/views/editDismissal";

test("decideEditDismissal keeps edit mode when clicking inside the draft", () => {
    assert.deepEqual(decideEditDismissal(true, true, false), {
        shouldSaveDraft: false,
        shouldClearActiveState: false,
        shouldClearRevealedCommentSelection: false,
    });
});

test("decideEditDismissal ignores clicks on another comment while editing", () => {
    assert.deepEqual(decideEditDismissal(false, true, false), {
        shouldSaveDraft: false,
        shouldClearActiveState: false,
        shouldClearRevealedCommentSelection: false,
    });
});

test("decideEditDismissal ignores sidebar background clicks while editing", () => {
    assert.deepEqual(decideEditDismissal(false, false, false), {
        shouldSaveDraft: false,
        shouldClearActiveState: false,
        shouldClearRevealedCommentSelection: false,
    });
});

test("decideEditDismissal ignores toolbar clicks while editing", () => {
    assert.deepEqual(decideEditDismissal(false, false, true), {
        shouldSaveDraft: false,
        shouldClearActiveState: false,
        shouldClearRevealedCommentSelection: false,
    });
});
