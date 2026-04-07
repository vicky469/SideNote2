import * as assert from "node:assert/strict";
import test from "node:test";
import { formatSidebarCommentMeta } from "../src/ui/views/sidebarCommentSections";

test("formatSidebarCommentMeta omits repeated page and anchored labels", () => {
    const anchoredMeta = formatSidebarCommentMeta({
        timestamp: Date.UTC(2024, 0, 1, 13, 30),
        anchorKind: "selection",
    });
    const pageMeta = formatSidebarCommentMeta({
        timestamp: Date.UTC(2024, 0, 1, 13, 30),
        anchorKind: "page",
    });
    const orphanedResolvedMeta = formatSidebarCommentMeta({
        timestamp: Date.UTC(2024, 0, 1, 13, 30),
        anchorKind: "selection",
        orphaned: true,
        resolved: true,
    });

    assert.equal(anchoredMeta.includes("anchored"), false);
    assert.equal(pageMeta.includes("page note"), false);
    assert.match(anchoredMeta, /[A-Za-z]{3}\s+\d{1,2}/);
    assert.match(anchoredMeta, /\d{1,2}:\d{2}/);
    assert.equal(orphanedResolvedMeta.includes("orphaned"), true);
    assert.equal(orphanedResolvedMeta.includes("resolved"), true);
});
