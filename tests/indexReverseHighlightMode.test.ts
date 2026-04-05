import * as assert from "node:assert/strict";
import test from "node:test";
import { getSidebarPersistedCommentPrimaryAction } from "../src/ui/views/indexReverseHighlightMode";

test("index reverse highlight mode uses reverse pairing when the sidebar file is the index note", () => {
    assert.equal(
        getSidebarPersistedCommentPrimaryAction(
            "SideNote2 index.md",
            (path) => path === "SideNote2 index.md",
        ),
        "index-highlight",
    );
});

test("index reverse highlight mode keeps source redirect for non-index files", () => {
    assert.equal(
        getSidebarPersistedCommentPrimaryAction(
            "docs/note.md",
            (path) => path === "SideNote2 index.md",
        ),
        "source-redirect",
    );
    assert.equal(
        getSidebarPersistedCommentPrimaryAction(
            null,
            (path) => path === "SideNote2 index.md",
        ),
        "source-redirect",
    );
});
