import * as assert from "node:assert/strict";
import test from "node:test";
import { findOpenWikiLinkQuery, replaceOpenWikiLinkQuery } from "../src/ui/editor/commentEditorLinks";

test("findOpenWikiLinkQuery detects an unfinished wikilink at the cursor", () => {
    const input = "Need follow-up in [[Project plan";
    const match = findOpenWikiLinkQuery(input, input.length, input.length);

    assert.deepEqual(match, {
        start: 18,
        end: input.length,
        query: "Project plan",
    });
});

test("findOpenWikiLinkQuery ignores closed wikilinks", () => {
    assert.equal(findOpenWikiLinkQuery("Reference [[Done]] note", 18, 18), null);
});

test("findOpenWikiLinkQuery ignores non-collapsed selections", () => {
    assert.equal(findOpenWikiLinkQuery("[[Draft", 2, 5), null);
});

test("replaceOpenWikiLinkQuery closes the wikilink and moves the cursor after it", () => {
    const input = "Need follow-up in [[Project plan";
    const replacement = "[[Projects/Project plan]]";
    const match = findOpenWikiLinkQuery(input, input.length, input.length);
    assert.ok(match);

    const edit = replaceOpenWikiLinkQuery(
        input,
        match,
        replacement,
    );

    assert.deepEqual(edit, {
        value: `Need follow-up in ${replacement}`,
        selectionStart: `Need follow-up in ${replacement}`.length,
        selectionEnd: `Need follow-up in ${replacement}`.length,
    });
});
