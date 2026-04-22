import * as assert from "node:assert/strict";
import test from "node:test";
import { getSidebarSearchHighlightRanges } from "../src/ui/views/sidebarSearchHighlight";

test("getSidebarSearchHighlightRanges returns ordered non-overlapping ranges for unique terms", () => {
    assert.deepEqual(
        getSidebarSearchHighlightRanges("Architecture review for API cleanup", "api architecture"),
        [
            { start: 0, end: 12 },
            { start: 24, end: 27 },
        ],
    );
});

test("getSidebarSearchHighlightRanges prefers longer terms before shorter overlaps", () => {
    assert.deepEqual(
        getSidebarSearchHighlightRanges("search searching searched", "search searching"),
        [
            { start: 0, end: 6 },
            { start: 7, end: 16 },
            { start: 17, end: 23 },
        ],
    );
});
