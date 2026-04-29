import * as assert from "node:assert/strict";
import test from "node:test";
import { extractTagsFromText, normalizeTagText } from "../src/core/text/commentTags";
import {
    findOpenTagQuery,
    replaceOpenTagQuery,
} from "../src/ui/editor/commentEditorTags";

test("findOpenTagQuery detects an unfinished tag at the cursor", () => {
    const input = "Need follow-up for #project/alpha";
    const match = findOpenTagQuery(input, input.length, input.length);

    assert.deepEqual(match, {
        start: 19,
        end: input.length,
        query: "project/alpha",
    });
});

test("findOpenTagQuery supports an empty query right after the hash", () => {
    const input = "Need follow-up for #";
    const match = findOpenTagQuery(input, input.length, input.length);

    assert.deepEqual(match, {
        start: 19,
        end: input.length,
        query: "",
    });
});

test("findOpenTagQuery ignores hashes inside other words", () => {
    assert.equal(findOpenTagQuery("release#candidate", 17, 17), null);
});

test("findOpenTagQuery ignores non-collapsed selections", () => {
    assert.equal(findOpenTagQuery("#draft", 1, 4), null);
});

test("replaceOpenTagQuery replaces the open tag token and moves the cursor", () => {
    const input = "Need follow-up for #pro";
    const match = findOpenTagQuery(input, input.length, input.length);
    assert.ok(match);

    const replacement = "#project/alpha";
    const edit = replaceOpenTagQuery(input, match, replacement);

    assert.deepEqual(edit, {
        value: "Need follow-up for #project/alpha",
        selectionStart: "Need follow-up for #project/alpha".length,
        selectionEnd: "Need follow-up for #project/alpha".length,
    });
});

test("extractTagsFromText finds inline comment tags", () => {
    assert.deepEqual(
        extractTagsFromText("Status #hi and #follow/up, but not release#candidate or # heading"),
        ["#hi", "#follow/up"],
    );
});

test("normalizeTagText trims whitespace and strips leading #", () => {
    assert.equal(normalizeTagText("  #Project/Alpha  "), "#Project/Alpha");
    assert.equal(normalizeTagText("##todo"), "#todo");
    assert.equal(normalizeTagText(""), "");
});
