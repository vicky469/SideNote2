import * as assert from "node:assert/strict";
import test from "node:test";
import type { App, TFile } from "obsidian";
import { getSideNoteLinkSuggestions } from "../src/ui/editor/commentLinkSuggestions";

function createFile(path: string): TFile {
    const basename = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
    return {
        path,
        basename,
    } as TFile;
}

function createApp(files: TFile[]): App {
    return {
        vault: {
            getMarkdownFiles: () => files,
            getAbstractFileByPath: (path: string) => files.find((file) => file.path === path) ?? null,
        },
        metadataCache: {
            fileToLinktext: (file: TFile) => file.path.replace(/\.md$/i, ""),
            getFirstLinkpathDest: (query: string) => {
                const normalized = query.toLowerCase().endsWith(".md") ? query : `${query}.md`;
                return files.find((file) => file.path === normalized) ?? null;
            },
        },
        fileManager: {
            getNewFileParent: () => ({ path: "Inbox" }),
        },
    } as unknown as App;
}

test("getSideNoteLinkSuggestions prepends a create suggestion for a new note", () => {
    const files = [
        createFile("Projects/Project plan.md"),
        createFile("Projects/Review.md"),
    ];
    const app = createApp(files);

    const suggestions = getSideNoteLinkSuggestions(app, "Fresh idea", "Notes/Today.md");
    const createSuggestion = suggestions[0];

    assert.equal(createSuggestion?.type, "create");
    assert.equal(createSuggestion && createSuggestion.type === "create" ? createSuggestion.notePath : null, "Inbox/Fresh idea.md");
    assert.equal(createSuggestion && createSuggestion.type === "create" ? createSuggestion.displayName : null, "Fresh idea");
});

test("getSideNoteLinkSuggestions omits create suggestion when the note already exists", () => {
    const files = [
        createFile("Projects/Project plan.md"),
        createFile("Inbox/Fresh idea.md"),
    ];
    const app = createApp(files);

    const suggestions = getSideNoteLinkSuggestions(app, "Inbox/Fresh idea", "Notes/Today.md");

    assert.equal(suggestions[0]?.type, "existing");
    assert.equal(suggestions.some((suggestion) => suggestion.type === "create"), false);
});

test("getSideNoteLinkSuggestions ranks closer basename matches first", () => {
    const files = [
        createFile("Reference/Alpha summary.md"),
        createFile("Projects/Alpha.md"),
        createFile("Projects/Beta alpha.md"),
    ];
    const app = createApp(files);

    const suggestions = getSideNoteLinkSuggestions(app, "Alpha", "Notes/Today.md");
    const existingSuggestions = suggestions.filter((suggestion) => suggestion.type === "existing");

    assert.equal(existingSuggestions[0] && existingSuggestions[0].type === "existing" ? existingSuggestions[0].file.path : null, "Projects/Alpha.md");
    assert.equal(existingSuggestions[1] && existingSuggestions[1].type === "existing" ? existingSuggestions[1].file.path : null, "Reference/Alpha summary.md");
});
