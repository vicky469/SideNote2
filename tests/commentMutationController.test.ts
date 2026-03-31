import * as assert from "node:assert/strict";
import test from "node:test";
import type { TFile } from "obsidian";
import { CommentManager, type Comment } from "../src/commentManager";
import {
    CommentMutationController,
    type CommentMutationHost,
} from "../src/control/commentMutationController";
import type { DraftComment } from "../src/domain/drafts";

function createFile(path: string): TFile {
    return {
        path,
        basename: path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path,
        extension: path.split(".").pop() ?? "",
    } as TFile;
}

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "Folder/Note.md",
        startLine: overrides.startLine ?? 2,
        startChar: overrides.startChar ?? 4,
        endLine: overrides.endLine ?? 2,
        endChar: overrides.endChar ?? 8,
        selectedText: overrides.selectedText ?? "beta",
        selectedTextHash: overrides.selectedTextHash ?? "hash:beta",
        comment: overrides.comment ?? "Original comment",
        timestamp: overrides.timestamp ?? 123,
        anchorKind: overrides.anchorKind ?? "selection",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
    };
}

function toDraft(comment: Comment, overrides: Partial<DraftComment> = {}): DraftComment {
    return {
        ...comment,
        mode: overrides.mode ?? "new",
        comment: overrides.comment ?? comment.comment,
    };
}

function createHost(options: {
    draftComment?: DraftComment | null;
    sidebarTargetFilePath?: string | null;
    knownComments?: Comment[];
    loadedComments?: Comment[];
    now?: number;
} = {}) {
    const manager = new CommentManager(options.loadedComments ?? options.knownComments ?? []);
    let draftComment = options.draftComment ?? null;
    let draftHostFilePath: string | null = draftComment?.filePath ?? null;
    let savingDraftCommentId: string | null = null;
    const notices: string[] = [];
    const loadedFiles: string[] = [];
    const persistedFiles: Array<{ path: string; immediateAggregateRefresh?: boolean }> = [];
    const highlightedCommentIds: string[] = [];
    const setDraftCalls: Array<{ draftComment: DraftComment | null; hostFilePath?: string | null }> = [];
    let refreshCommentViewsCount = 0;
    let refreshEditorDecorationsCount = 0;

    const filesByPath = new Map<string, TFile>();
    for (const comment of options.knownComments ?? options.loadedComments ?? []) {
        filesByPath.set(comment.filePath, createFile(comment.filePath));
    }

    const knownCommentsById = new Map((options.knownComments ?? options.loadedComments ?? []).map((comment) => [comment.id, comment]));

    const host: CommentMutationHost = {
        getAllCommentsNotePath: () => "SideNote2 index.md",
        getSidebarTargetFilePath: () => options.sidebarTargetFilePath ?? null,
        getDraftComment: () => draftComment,
        getSavingDraftCommentId: () => savingDraftCommentId,
        setDraftComment: async (nextDraftComment, hostFilePath) => {
            draftComment = nextDraftComment;
            draftHostFilePath = nextDraftComment ? (hostFilePath ?? nextDraftComment.filePath) : null;
            setDraftCalls.push({ draftComment: nextDraftComment, hostFilePath });
        },
        setDraftCommentValue: (nextDraftComment) => {
            draftComment = nextDraftComment;
        },
        clearDraftState: () => {
            draftComment = null;
            draftHostFilePath = null;
        },
        setSavingDraftCommentId: (commentId) => {
            savingDraftCommentId = commentId;
        },
        refreshCommentViews: async () => {
            refreshCommentViewsCount += 1;
        },
        refreshEditorDecorations: () => {
            refreshEditorDecorationsCount += 1;
        },
        getKnownCommentById: (commentId) => knownCommentsById.get(commentId) ?? null,
        getLoadedCommentById: (commentId) => manager.getCommentById(commentId) ?? null,
        getFileByPath: (filePath) => filesByPath.get(filePath) ?? null,
        isCommentableFile: (file): file is TFile => !!file && (file.extension === "md" || file.extension === "pdf"),
        loadCommentsForFile: async (file) => {
            loadedFiles.push(file.path);
        },
        persistCommentsForFile: async (file, persistOptions) => {
            persistedFiles.push({
                path: file.path,
                immediateAggregateRefresh: persistOptions?.immediateAggregateRefresh,
            });
        },
        getCommentManager: () => manager,
        activateViewAndHighlightComment: async (commentId) => {
            highlightedCommentIds.push(commentId);
        },
        showNotice: (message) => {
            notices.push(message);
        },
        now: () => options.now ?? 1_000,
    };

    return {
        controller: new CommentMutationController(host),
        manager,
        notices,
        loadedFiles,
        persistedFiles,
        highlightedCommentIds,
        setDraftCalls,
        getDraftComment: () => draftComment,
        getDraftHostFilePath: () => draftHostFilePath,
        getSavingDraftCommentId: () => savingDraftCommentId,
        getRefreshCommentViewsCount: () => refreshCommentViewsCount,
        getRefreshEditorDecorationsCount: () => refreshEditorDecorationsCount,
    };
}

test("comment mutation controller starts an edit draft from the latest loaded comment", async () => {
    const comment = createComment({ comment: "Existing note" });
    const host = createHost({
        knownComments: [comment],
        loadedComments: [comment],
        sidebarTargetFilePath: "SideNote2 index.md",
    });

    const started = await host.controller.startEditDraft(comment.id);

    assert.equal(started, true);
    assert.deepEqual(host.loadedFiles, [comment.filePath]);
    assert.deepEqual(host.highlightedCommentIds, [comment.id]);
    assert.equal(host.setDraftCalls.length, 1);
    assert.equal(host.getDraftHostFilePath(), "SideNote2 index.md");
    assert.deepEqual(host.getDraftComment(), {
        ...comment,
        mode: "edit",
    });
});

test("comment mutation controller saves a new draft by trimming and persisting it", async () => {
    const draft = toDraft(createComment({
        id: "draft-1",
        comment: "  Ship it  ",
    }));
    const host = createHost({
        draftComment: draft,
        knownComments: [draft],
        loadedComments: [],
    });

    await host.controller.saveDraft(draft.id);

    assert.equal(host.manager.getAllComments().length, 1);
    assert.equal(host.manager.getAllComments()[0].comment, "Ship it");
    assert.deepEqual(host.persistedFiles, [{
        path: draft.filePath,
        immediateAggregateRefresh: true,
    }]);
    assert.equal(host.getDraftComment(), null);
    assert.equal(host.getSavingDraftCommentId(), null);
    assert.equal(host.getRefreshCommentViewsCount() >= 2, true);
    assert.equal(host.getRefreshEditorDecorationsCount(), 1);
    assert.deepEqual(host.notices, []);
});

test("comment mutation controller suppresses duplicate adds inside the dedupe window", async () => {
    const comment = createComment();
    const host = createHost({
        loadedComments: [],
        knownComments: [comment],
        now: 500,
    });

    const firstAdded = await host.controller.addComment(comment);
    const secondAdded = await host.controller.addComment({ ...comment, id: "comment-2" });

    assert.equal(firstAdded, true);
    assert.equal(secondAdded, false);
    assert.equal(host.manager.getAllComments().length, 1);
    assert.equal(host.persistedFiles.length, 1);
});

test("comment mutation controller resolves an existing comment and persists the change", async () => {
    const comment = createComment({ resolved: false });
    const host = createHost({
        knownComments: [comment],
        loadedComments: [comment],
    });

    await host.controller.resolveComment(comment.id);

    assert.equal(host.manager.getCommentById(comment.id)?.resolved, true);
    assert.deepEqual(host.persistedFiles, [{
        path: comment.filePath,
        immediateAggregateRefresh: true,
    }]);
    assert.deepEqual(host.notices, []);
});
