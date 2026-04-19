import * as assert from "node:assert/strict";
import test from "node:test";
import { MAX_SIDENOTE_WORDS, countCommentWords, exceedsCommentWordLimit } from "../src/core/text/commentWordLimit";

test("comment word limit is 250 words", () => {
    assert.equal(MAX_SIDENOTE_WORDS, 250);
});

test("exceedsCommentWordLimit allows 250 words and rejects 251", () => {
    const withinLimit = Array.from({ length: 250 }, (_, index) => `word${index}`).join(" ");
    const overLimit = `${withinLimit} extra`;

    assert.equal(countCommentWords(withinLimit), 250);
    assert.equal(exceedsCommentWordLimit(withinLimit), false);
    assert.equal(countCommentWords(overLimit), 251);
    assert.equal(exceedsCommentWordLimit(overLimit), true);
});
