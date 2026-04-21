import * as assert from "node:assert/strict";
import test from "node:test";
import type { Comment } from "../src/commentManager";
import type { DraftComment } from "../src/domain/drafts";
import {
    SidebarDraftEditorController,
    estimateDraftTextareaRows,
    getSidebarComments,
} from "../src/ui/views/sidebarDraftEditor";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "docs/architecture.md",
        startLine: overrides.startLine ?? 5,
        startChar: overrides.startChar ?? 1,
        endLine: overrides.endLine ?? 5,
        endChar: overrides.endChar ?? 8,
        selectedText: overrides.selectedText ?? "comment",
        selectedTextHash: overrides.selectedTextHash ?? "hash:comment",
        comment: overrides.comment ?? "Comment body",
        timestamp: overrides.timestamp ?? 100,
        anchorKind: overrides.anchorKind ?? "selection",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
    };
}

function createDraft(overrides: Partial<DraftComment> = {}): DraftComment {
    return {
        ...createComment(overrides),
        mode: overrides.mode ?? "new",
    };
}

function createDraftEditorController() {
    return new SidebarDraftEditorController({
        buildSideNoteReferenceMarkdownForComment: () => "[A](obsidian://side-note2-comment?vault=dev&file=docs%2Fa.md&commentId=target-1)",
        getAllIndexedComments: () => [],
        localVaultName: "dev",
        updateDraftCommentText: () => {},
        renderComments: async () => {},
        scheduleDraftFocus: () => {},
        openLinkSuggestModal: () => {},
        openSideNoteReferenceSuggestModal: () => {},
        openTagSuggestModal: () => {},
    });
}

test("getSidebarComments replaces the persisted version of the draft, hides resolved comments, and sorts consistently", () => {
    const persistedComments = [
        createComment({ id: "comment-b", filePath: "docs/b.md", startLine: 8, timestamp: 300 }),
        createComment({ id: "draft-1", filePath: "docs/b.md", startLine: 12, timestamp: 400 }),
        createComment({ id: "comment-resolved", filePath: "docs/a.md", resolved: true, timestamp: 50 }),
        createComment({ id: "comment-page", filePath: "docs/a.md", anchorKind: "page", startLine: 20, startChar: 0, endLine: 20, endChar: 0, timestamp: 150 }),
        createComment({ id: "comment-a", filePath: "docs/a.md", startLine: 3, timestamp: 200 }),
    ];
    const draft = createDraft({
        id: "draft-1",
        filePath: "docs/b.md",
        startLine: 12,
        timestamp: 500,
        comment: "Draft body",
    });

    const comments = getSidebarComments(persistedComments, draft, false);

    assert.deepEqual(comments.map((comment) => ({
        id: comment.id,
        filePath: comment.filePath,
        timestamp: comment.timestamp,
        isDraft: "mode" in comment,
    })), [
        { id: "comment-page", filePath: "docs/a.md", timestamp: 150, isDraft: false },
        { id: "comment-a", filePath: "docs/a.md", timestamp: 200, isDraft: false },
        { id: "comment-b", filePath: "docs/b.md", timestamp: 300, isDraft: false },
        { id: "draft-1", filePath: "docs/b.md", timestamp: 500, isDraft: true },
    ]);
});

test("getSidebarComments applies file filters to both persisted comments and drafts", () => {
    const persistedComments = [
        createComment({ id: "comment-a", filePath: "docs/a.md", timestamp: 100 }),
        createComment({ id: "comment-b", filePath: "docs/b.md", timestamp: 200 }),
    ];
    const draft = createDraft({
        id: "draft-1",
        filePath: "docs/c.md",
        timestamp: 300,
    });

    assert.deepEqual(
        getSidebarComments(persistedComments, draft, false, ["docs/b.md"]).map((comment) => comment.id),
        ["comment-b"],
    );
    assert.deepEqual(
        getSidebarComments(persistedComments, draft, false, ["docs/c.md"]).map((comment) => comment.id),
        ["draft-1"],
    );
});

test("getSidebarComments shows only resolved comments when the resolved toggle is on", () => {
    const persistedComments = [
        createComment({ id: "comment-unresolved", filePath: "docs/a.md", timestamp: 100, resolved: false }),
        createComment({ id: "comment-resolved", filePath: "docs/a.md", timestamp: 200, resolved: true }),
    ];

    assert.deepEqual(
        getSidebarComments(persistedComments, null, true).map((comment) => comment.id),
        ["comment-resolved"],
    );
});

test("estimateDraftTextareaRows keeps draft editors within their intended bounds", () => {
    assert.equal(estimateDraftTextareaRows("Short", false), 2);
    assert.equal(estimateDraftTextareaRows("Short", true), 2);

    const longLine = "x".repeat(2_000);
    assert.equal(estimateDraftTextareaRows(longLine, false), 10);
    assert.equal(estimateDraftTextareaRows(longLine, true), 18);
});

test("sidebar draft editor controller applies bold formatting directly", () => {
    const dispatchedEvents: string[] = [];
    const controller = createDraftEditorController();
    const textarea = {
        value: "hello world",
        selectionStart: 6,
        selectionEnd: 11,
        dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type);
            return true;
        },
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;

    controller.applyDraftBold("draft-1", textarea, false);

    assert.equal(textarea.value, "hello **world**");
    assert.equal(textarea.selectionStart, 8);
    assert.equal(textarea.selectionEnd, 13);
    assert.deepEqual(dispatchedEvents, ["input"]);
});

test("sidebar draft editor controller applies highlight formatting directly", () => {
    const dispatchedEvents: string[] = [];
    const controller = createDraftEditorController();
    const textarea = {
        value: "hello world",
        selectionStart: 6,
        selectionEnd: 11,
        dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type);
            return true;
        },
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;

    controller.applyDraftHighlight("draft-1", textarea, false);

    assert.equal(textarea.value, "hello ==world==");
    assert.equal(textarea.selectionStart, 8);
    assert.equal(textarea.selectionEnd, 13);
    assert.deepEqual(dispatchedEvents, ["input"]);
});

test("sidebar draft editor controller inserts a side note reference from the explicit picker", async () => {
    let chooseReference: ((commentId: string) => Promise<void>) | null = null;
    const controller = new SidebarDraftEditorController({
        buildSideNoteReferenceMarkdownForComment: () =>
            "[this](obsidian://side-note2-comment?vault=dev&file=docs%2Ftarget.md&commentId=target-1)",
        getAllIndexedComments: () => [],
        localVaultName: "dev",
        updateDraftCommentText: () => {},
        renderComments: async () => {},
        scheduleDraftFocus: () => {},
        openLinkSuggestModal: () => {},
        openSideNoteReferenceSuggestModal: (options) => {
            chooseReference = options.onChooseReference;
        },
        openTagSuggestModal: () => {},
    });
    const dispatchedEvents: string[] = [];
    const textarea = {
        value: "Link this text",
        selectionStart: 5,
        selectionEnd: 9,
        isConnected: true,
        dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type);
            return true;
        },
        focus: () => {},
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;
    const draft = createDraft({
        id: "draft-1",
        comment: textarea.value,
        threadId: "thread-1",
    });

    assert.equal(controller.openDraftSideNoteReferenceSuggest(draft, textarea, false), true);
    assert.ok(chooseReference);
    const onChooseReference = chooseReference as (commentId: string) => Promise<void>;
    await onChooseReference("target-1");

    assert.equal(
        textarea.value,
        "Link this text\n\nMentioned:\n- [this](obsidian://side-note2-comment?vault=dev&file=docs%2Ftarget.md&commentId=target-1)",
    );
    assert.deepEqual(dispatchedEvents, ["input"]);
});

test("sidebar draft editor controller appends button-inserted references under the existing Mentioned section", async () => {
    let chooseReference: ((commentId: string) => Promise<void>) | null = null;
    const controller = new SidebarDraftEditorController({
        buildSideNoteReferenceMarkdownForComment: () =>
            "[other](obsidian://side-note2-comment?vault=dev&file=docs%2Fother.md&commentId=target-2)",
        getAllIndexedComments: () => [],
        localVaultName: "dev",
        updateDraftCommentText: () => {},
        renderComments: async () => {},
        scheduleDraftFocus: () => {},
        openLinkSuggestModal: () => {},
        openSideNoteReferenceSuggestModal: (options) => {
            chooseReference = options.onChooseReference;
        },
        openTagSuggestModal: () => {},
    });
    const textarea = {
        value: "Body copy\n\nMentioned:\n- [this](obsidian://side-note2-comment?vault=dev&file=docs%2Ftarget.md&commentId=target-1)",
        selectionStart: 0,
        selectionEnd: 0,
        isConnected: true,
        dispatchEvent: () => true,
        focus: () => {},
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;
    const draft = createDraft({
        id: "draft-1",
        comment: textarea.value,
        threadId: "thread-1",
    });

    assert.equal(controller.openDraftSideNoteReferenceSuggest(draft, textarea, false), true);
    assert.ok(chooseReference);
    const onChooseReference = chooseReference as (commentId: string) => Promise<void>;
    await onChooseReference("target-2");

    assert.equal(
        textarea.value,
        "Body copy\n\nMentioned:\n- [this](obsidian://side-note2-comment?vault=dev&file=docs%2Ftarget.md&commentId=target-1)\n- [other](obsidian://side-note2-comment?vault=dev&file=docs%2Fother.md&commentId=target-2)",
    );
});

test("sidebar draft editor controller normalizes pasted raw side note urls into labeled markdown links", () => {
    const controller = createDraftEditorController();
    const dispatchedEvents: string[] = [];
    const textarea = {
        value: "Paste here",
        selectionStart: 6,
        selectionEnd: 10,
        dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type);
            return true;
        },
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;

    const changed = controller.normalizePastedSideNoteReferences(
        createDraft({ id: "draft-1", comment: textarea.value }),
        textarea,
        "obsidian://side-note2-comment?vault=dev&file=docs%2Fa.md&commentId=target-1",
        false,
    );

    assert.equal(changed, true);
    assert.equal(textarea.value, "Paste [A](obsidian://side-note2-comment?vault=dev&file=docs%2Fa.md&commentId=target-1)");
    assert.deepEqual(dispatchedEvents, ["input"]);
});

test("sidebar draft editor controller leaves foreign-vault raw side note urls untouched when pasting", () => {
    const controller = createDraftEditorController();
    const dispatchedEvents: string[] = [];
    const textarea = {
        value: "Paste here",
        selectionStart: 6,
        selectionEnd: 10,
        dispatchEvent: (event: Event) => {
            dispatchedEvents.push(event.type);
            return true;
        },
        setSelectionRange(start: number, end: number) {
            textarea.selectionStart = start;
            textarea.selectionEnd = end;
        },
        rows: 4,
    } as unknown as HTMLTextAreaElement;

    const changed = controller.normalizePastedSideNoteReferences(
        createDraft({ id: "draft-1", comment: textarea.value }),
        textarea,
        "obsidian://side-note2-comment?vault=other&file=docs%2Fa.md&commentId=target-1",
        false,
    );

    assert.equal(changed, false);
    assert.equal(textarea.value, "Paste here");
    assert.deepEqual(dispatchedEvents, []);
});
