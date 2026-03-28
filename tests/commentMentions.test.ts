import * as assert from "node:assert/strict";
import test from "node:test";
import { buildDerivedCommentLinks, extractWikiLinkPaths, extractWikiLinks } from "../src/core/commentMentions";
import type { Comment } from "../src/commentManager";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: "comment-1",
        filePath: "tmp.md",
        startLine: 0,
        startChar: 0,
        endLine: 0,
        endChar: 0,
        selectedText: "tmp",
        selectedTextHash: "hash-1",
        comment: "",
        timestamp: 1710000000000,
        resolved: false,
        ...overrides,
    };
}

test("extractWikiLinkPaths returns wiki link targets in order", () => {
    assert.deepEqual(
        extractWikiLinkPaths("See [[Alpha]] then [[Folder/Beta|Beta alias]] and [[Gamma#Section]]."),
        ["Alpha", "Folder/Beta", "Gamma"],
    );
});

test("extractWikiLinks keeps original markup and alias text", () => {
    assert.deepEqual(
        extractWikiLinks("See [[Alpha]] then [[Folder/Beta|Beta alias]]."),
        [
            { linkPath: "Alpha", original: "[[Alpha]]" },
            { linkPath: "Folder/Beta", original: "[[Folder/Beta|Beta alias]]", displayText: "Beta alias" },
        ],
    );
});

test("extractWikiLinkPaths skips embeds, blank links, multiline links, and unfinished links", () => {
    assert.deepEqual(
        extractWikiLinkPaths("![[Embed]] [[ ]] [[Line\nBreak]] [[Open"),
        [],
    );
});

test("buildDerivedCommentLinks creates native link cache entries and counts", () => {
    const derivedLinks = buildDerivedCommentLinks(
        [
            createComment({
                startLine: 2,
                startChar: 1,
                comment: "See [[tmp3]] and [[tmp3|Alias]] plus [[Missing]].",
            }),
            createComment({
                id: "comment-2",
                startLine: 4,
                startChar: 0,
                comment: "Track [[tmp4]].",
            }),
        ],
        "line 0\nline 1\nline 2\nline 3\nline 4",
        (linkPath) => {
            if (linkPath === "tmp3") {
                return "tmp3.md";
            }

            if (linkPath === "tmp4") {
                return "tmp4.md";
            }

            return null;
        },
    );

    assert.deepEqual(derivedLinks.resolved, {
        "tmp3.md": 1,
        "tmp4.md": 1,
    });
    assert.deepEqual(derivedLinks.unresolved, {
        Missing: 1,
    });
    assert.deepEqual(
        derivedLinks.links.map((link) => ({
            link: link.link,
            original: link.original,
            displayText: link.displayText,
            line: link.position.start.line,
            col: link.position.start.col,
        })),
        [
            { link: "tmp3", original: "[[tmp3]]", displayText: undefined, line: 2, col: 1 },
            { link: "Missing", original: "[[Missing]]", displayText: undefined, line: 2, col: 1 },
            { link: "tmp4", original: "[[tmp4]]", displayText: undefined, line: 4, col: 0 },
        ],
    );
});

test("buildDerivedCommentLinks skips resolved comments and self-links", () => {
    const derivedLinks = buildDerivedCommentLinks(
        [
            createComment({
                comment: "[[tmp]] [[tmp5]]",
            }),
            createComment({
                id: "comment-2",
                resolved: true,
                comment: "[[tmp6]]",
            }),
        ],
        "tmp",
        (linkPath) => `${linkPath}.md`,
    );

    assert.deepEqual(derivedLinks.resolved, {
        "tmp5.md": 1,
    });
    assert.deepEqual(derivedLinks.unresolved, {});
    assert.equal(derivedLinks.links.length, 1);
    assert.equal(derivedLinks.links[0]?.link, "tmp5");
});
