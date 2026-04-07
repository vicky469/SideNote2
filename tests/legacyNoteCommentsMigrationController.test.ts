import * as assert from "node:assert/strict";
import test from "node:test";
import type { MarkdownView, TFile } from "obsidian";
import {
    LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION,
    LegacyNoteCommentsMigrationController,
    type LegacyNoteCommentsMigrationHost,
} from "../src/control/legacyNoteCommentsMigrationController";
import { parseNoteComments } from "../src/core/storage/noteCommentStorage";
import type { SideNote2Settings } from "../src/ui/settings/SideNote2SettingTab";

function createFile(path: string): TFile {
    return {
        path,
        basename: path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path,
        extension: path.split(".").pop() ?? "",
    } as TFile;
}

function createSettings(overrides: Partial<SideNote2Settings> = {}): SideNote2Settings {
    return {
        enableDebugMode: false,
        indexNotePath: overrides.indexNotePath ?? "SideNote2 index.md",
        indexHeaderImageUrl: "",
        indexHeaderImageCaption: "",
        lastMigratedNoteCommentStorageVersion: overrides.lastMigratedNoteCommentStorageVersion ?? null,
    };
}

function createLegacyNoteContent(options: {
    id?: string;
    selectedText?: string;
    comment?: string;
    mainContent?: string;
} = {}): string {
    return [
        options.mainContent?.trimEnd() ?? "# Title\n\nVisible body.",
        "",
        "<!-- SideNote2 comments",
        "[",
        "  {",
        `    "id": "${options.id ?? "legacy-comment-1"}",`,
        '    "startLine": 0,',
        '    "startChar": 0,',
        '    "endLine": 0,',
        '    "endChar": 5,',
        `    "selectedText": "${options.selectedText ?? "Title"}",`,
        '    "selectedTextHash": "hash-title",',
        `    "comment": ${JSON.stringify(options.comment ?? "Legacy flat note body")},`,
        '    "timestamp": 1710000000000',
        "  }",
        "]",
        "-->",
        "",
    ].join("\n");
}

function createHarness(options: {
    settings?: SideNote2Settings;
    fileContents: Record<string, string>;
    openViewPaths?: string[];
    processTransformers?: Record<string, (currentContent: string) => string>;
}): {
    controller: LegacyNoteCommentsMigrationController;
    getSettings(): SideNote2Settings;
    getContent(filePath: string): string;
    processCalls: string[];
    notices: string[];
    warnings: Array<{ message: string; error: unknown }>;
    getSaveSettingsCount(): number;
    getLoadVisibleFilesCount(): number;
    getRefreshCommentViewsCount(): number;
    getRefreshEditorDecorationsCount(): number;
    getRefreshAggregateNoteNowCount(): number;
    getOpenViewSaveCount(filePath: string): number;
} {
    let settings = options.settings ?? createSettings();
    const filesByPath = new Map<string, TFile>();
    const fileContents = new Map<string, string>(Object.entries(options.fileContents));
    const openViewSaveCounts = new Map<string, number>();
    const openViewsByPath = new Map<string, MarkdownView>();
    const notices: string[] = [];
    const warnings: Array<{ message: string; error: unknown }> = [];
    const processCalls: string[] = [];
    let saveSettingsCount = 0;
    let loadVisibleFilesCount = 0;
    let refreshCommentViewsCount = 0;
    let refreshEditorDecorationsCount = 0;
    let refreshAggregateNoteNowCount = 0;

    for (const filePath of fileContents.keys()) {
        filesByPath.set(filePath, createFile(filePath));
    }

    for (const filePath of options.openViewPaths ?? []) {
        let editorValue = fileContents.get(filePath) ?? "";
        openViewsByPath.set(filePath, {
            editor: {
                getValue: () => editorValue,
                setValue: (value: string) => {
                    editorValue = value;
                },
            },
            save: async () => {
                openViewSaveCounts.set(filePath, (openViewSaveCounts.get(filePath) ?? 0) + 1);
                fileContents.set(filePath, editorValue);
            },
        } as MarkdownView);
    }

    const host = {
        app: {
            vault: {
                getMarkdownFiles: () => Array.from(filesByPath.values()),
                process: async (file: TFile, fn: (content: string) => string) => {
                    processCalls.push(file.path);
                    const transformer = options.processTransformers?.[file.path];
                    const currentContent = transformer
                        ? transformer(fileContents.get(file.path) ?? "")
                        : (fileContents.get(file.path) ?? "");
                    fileContents.set(file.path, currentContent);
                    const nextContent = fn(currentContent);
                    fileContents.set(file.path, nextContent);
                    return nextContent;
                },
            },
        },
        getSettings: () => settings,
        setSettings: (nextSettings: SideNote2Settings) => {
            settings = nextSettings;
        },
        saveSettings: async () => {
            saveSettingsCount += 1;
        },
        getAllCommentsNotePath: () => settings.indexNotePath,
        getCurrentNoteContent: async (file: TFile) => openViewsByPath.get(file.path)?.editor.getValue() ?? fileContents.get(file.path) ?? "",
        getMarkdownViewForFile: (file: TFile) => openViewsByPath.get(file.path) ?? null,
        loadVisibleFiles: async () => {
            loadVisibleFilesCount += 1;
        },
        refreshCommentViews: async () => {
            refreshCommentViewsCount += 1;
        },
        refreshEditorDecorations: () => {
            refreshEditorDecorationsCount += 1;
        },
        refreshAggregateNoteNow: async () => {
            refreshAggregateNoteNowCount += 1;
        },
        showNotice: (message: string) => {
            notices.push(message);
        },
        warn: (message: string, error: unknown) => {
            warnings.push({ message, error });
        },
    } as unknown as LegacyNoteCommentsMigrationHost;

    return {
        controller: new LegacyNoteCommentsMigrationController(host),
        getSettings: () => settings,
        getContent: (filePath: string) => fileContents.get(filePath) ?? "",
        processCalls,
        notices,
        warnings,
        getSaveSettingsCount: () => saveSettingsCount,
        getLoadVisibleFilesCount: () => loadVisibleFilesCount,
        getRefreshCommentViewsCount: () => refreshCommentViewsCount,
        getRefreshEditorDecorationsCount: () => refreshEditorDecorationsCount,
        getRefreshAggregateNoteNowCount: () => refreshAggregateNoteNowCount,
        getOpenViewSaveCount: (filePath: string) => openViewSaveCounts.get(filePath) ?? 0,
    };
}

test("startup migration converts legacy notes once, skips the index note, and persists the storage marker", async () => {
    const harness = createHarness({
        fileContents: {
            "docs/legacy.md": createLegacyNoteContent(),
            "docs/threaded.md": [
                "# Threaded",
                "",
                "<!-- SideNote2 comments",
                "[",
                '  { "id": "thread-1", "startLine": 0, "startChar": 0, "endLine": 0, "endChar": 0, "selectedText": "Threaded", "selectedTextHash": "hash-threaded", "entries": [ { "id": "entry-1", "body": "Already threaded", "timestamp": 1710000000000 } ], "createdAt": 1710000000000, "updatedAt": 1710000000000 }',
                "]",
                "-->",
                "",
            ].join("\n"),
            "SideNote2 index.md": createLegacyNoteContent({ id: "legacy-index-comment" }),
        },
        openViewPaths: ["docs/legacy.md"],
    });

    await harness.controller.runStartupMigrationIfNeeded();

    const migrated = harness.getContent("docs/legacy.md");
    assert.equal(parseNoteComments(migrated, "docs/legacy.md").threads.length, 1);
    assert.doesNotMatch(migrated, /"comment":/);
    assert.match(migrated, /"entries": \[/);
    assert.match(harness.getContent("SideNote2 index.md"), /"comment":/);
    assert.equal(harness.getOpenViewSaveCount("docs/legacy.md"), 1);
    assert.deepEqual(harness.processCalls, []);
    assert.equal(harness.getSettings().lastMigratedNoteCommentStorageVersion, LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION);
    assert.equal(harness.getSaveSettingsCount(), 1);
    assert.equal(harness.getLoadVisibleFilesCount(), 1);
    assert.equal(harness.getRefreshCommentViewsCount(), 1);
    assert.equal(harness.getRefreshEditorDecorationsCount(), 1);
    assert.equal(harness.getRefreshAggregateNoteNowCount(), 1);
    assert.deepEqual(harness.warnings, []);
    assert.match(harness.notices[0], /Migrated 1 legacy SideNote2 note comment/);

    await harness.controller.runStartupMigrationIfNeeded();

    assert.equal(harness.getSaveSettingsCount(), 1);
    assert.equal(harness.notices.length, 1);
    assert.equal(harness.getLoadVisibleFilesCount(), 1);
});

test("startup migration leaves the marker unset when notes change during migration so the next launch can retry", async () => {
    const harness = createHarness({
        fileContents: {
            "docs/legacy.md": createLegacyNoteContent(),
        },
        processTransformers: {
            "docs/legacy.md": () => "# Title\n\nChanged elsewhere.\n",
        },
    });

    await harness.controller.runStartupMigrationIfNeeded();

    assert.equal(harness.getSettings().lastMigratedNoteCommentStorageVersion, null);
    assert.equal(harness.getSaveSettingsCount(), 0);
    assert.equal(harness.getLoadVisibleFilesCount(), 0);
    assert.equal(harness.getRefreshAggregateNoteNowCount(), 0);
    assert.match(harness.notices[0], /will retry next launch/);
});
