import * as assert from "node:assert/strict";
import test from "node:test";
import type { Comment } from "../src/commentManager";
import { SidebarInteractionController } from "../src/ui/views/sidebarInteractionController";

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "docs/architecture.md",
        startLine: overrides.startLine ?? 4,
        startChar: overrides.startChar ?? 1,
        endLine: overrides.endLine ?? 4,
        endChar: overrides.endChar ?? 7,
        selectedText: overrides.selectedText ?? "comment",
        selectedTextHash: overrides.selectedTextHash ?? "hash:comment",
        comment: overrides.comment ?? "Comment body",
        timestamp: overrides.timestamp ?? 100,
        anchorKind: overrides.anchorKind ?? "selection",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
    };
}

type FakeCommentElement = {
    addClassCalls: string[];
    removeClassCalls: string[];
    scrollCalls: number;
    dataCommentId?: string;
    dataDraftId?: string;
    getAttribute(name: string): string | null;
    addClass(name: string): void;
    removeClass(name: string): void;
    scrollIntoView(options: unknown): void;
};

function createCommentElement(ids: { commentId?: string; draftId?: string } = {}): FakeCommentElement {
    return {
        addClassCalls: [],
        removeClassCalls: [],
        scrollCalls: 0,
        dataCommentId: ids.commentId,
        dataDraftId: ids.draftId,
        getAttribute(name: string) {
            if (name === "data-comment-id") {
                return this.dataCommentId ?? null;
            }
            if (name === "data-draft-id") {
                return this.dataDraftId ?? null;
            }
            return null;
        },
        addClass(name: string) {
            this.addClassCalls.push(name);
        },
        removeClass(name: string) {
            this.removeClassCalls.push(name);
        },
        scrollIntoView(_options: unknown) {
            this.scrollCalls += 1;
        },
    };
}

function createHarness() {
    const matchingCommentEl = createCommentElement({ commentId: "comment-1" });
    const otherActiveEl = createCommentElement({ commentId: "comment-2" });
    let renderCalls = 0;
    const revealedComments: string[] = [];

    const controller = new SidebarInteractionController({
        app: {
            workspace: {
                activeLeaf: null,
                setActiveLeaf: () => {},
            },
        } as never,
        leaf: {} as never,
        containerEl: {
            querySelector: (selector: string) => {
                if (selector.includes("comment-1")) {
                    return matchingCommentEl;
                }
                return null;
            },
            querySelectorAll: () => [otherActiveEl],
            contains: () => true,
        } as never,
        getCurrentFile: () => null,
        getDraftForView: () => null,
        renderComments: async () => {
            renderCalls += 1;
        },
        saveDraft: () => {},
        cancelDraft: () => {},
        clearRevealedCommentSelection: () => {},
        revealComment: async (comment) => {
            revealedComments.push(comment.id);
        },
        getPreferredFileLeaf: () => null,
        openLinkText: async () => {},
    });

    return {
        controller,
        matchingCommentEl,
        otherActiveEl,
        getRenderCalls: () => renderCalls,
        revealedComments,
    };
}

test("sidebar interaction controller highlights a comment by rerendering and scrolling it into view", async () => {
    const harness = createHarness();

    harness.controller.highlightComment("comment-1");
    await Promise.resolve();

    assert.equal(harness.controller.getActiveCommentId(), "comment-1");
    assert.equal(harness.getRenderCalls(), 1);
    assert.equal(harness.matchingCommentEl.scrollCalls, 1);
});

test("sidebar interaction controller opens a comment by marking it active and revealing it", async () => {
    const harness = createHarness();

    await harness.controller.openCommentInEditor(createComment({ id: "comment-1" }));

    assert.equal(harness.controller.getActiveCommentId(), "comment-1");
    assert.deepEqual(harness.revealedComments, ["comment-1"]);
    assert.deepEqual(harness.otherActiveEl.removeClassCalls, ["active"]);
    assert.deepEqual(harness.matchingCommentEl.addClassCalls, ["active"]);
});

test("sidebar interaction controller clears active state classes", () => {
    const harness = createHarness();

    harness.controller.clearActiveState();

    assert.equal(harness.controller.getActiveCommentId(), null);
    assert.deepEqual(harness.otherActiveEl.removeClassCalls, ["active"]);
});
