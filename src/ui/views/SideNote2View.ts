import { ItemView, MarkdownRenderer, TFile, WorkspaceLeaf, setIcon, type ViewStateResult } from "obsidian";
import type { Comment } from "../../commentManager";
import type { DraftComment } from "../../domain/drafts";
import type SideNote2 from "../../main";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";
import SideNoteLinkSuggestModal from "../modals/SideNoteLinkSuggestModal";
import SideNoteTagSuggestModal from "../modals/SideNoteTagSuggestModal";
import { SIDE_NOTE2_ICON_ID } from "../sideNote2Icon";
import { buildSidebarSections, type SidebarSectionKey } from "./sidebarCommentSections";
import {
    SidebarDraftEditorController,
    getSidebarComments,
} from "./sidebarDraftEditor";
import { renderDraftCommentCard } from "./sidebarDraftComment";
import { SidebarInteractionController } from "./sidebarInteractionController";
import { renderPersistedCommentCard } from "./sidebarPersistedComment";
import type { CustomViewState } from "./viewState";

function isDraftComment(comment: Comment | DraftComment): comment is DraftComment {
    return "mode" in comment;
}

export default class SideNote2View extends ItemView {
    private file: TFile | null = null;
    private plugin: SideNote2;
    private renderVersion = 0;
    private readonly draftEditorController: SidebarDraftEditorController;
    private readonly interactionController: SidebarInteractionController;
    private readonly sectionExpandedState: Record<SidebarSectionKey, boolean> = {
        page: true,
        anchored: true,
    };

    constructor(leaf: WorkspaceLeaf, plugin: SideNote2, file: TFile | null = null) {
        super(leaf);
        this.plugin = plugin;
        this.file = file;
        this.interactionController = new SidebarInteractionController({
            app: this.app,
            leaf: this.leaf,
            containerEl: this.containerEl,
            getCurrentFile: () => this.file,
            getDraftForView: (filePath) => this.plugin.getDraftForView(filePath),
            renderComments: () => this.renderComments(),
            saveDraft: (commentId) => {
                void this.plugin.saveDraft(commentId);
            },
            cancelDraft: (commentId) => {
                void this.plugin.cancelDraft(commentId);
            },
            clearRevealedCommentSelection: () => {
                this.plugin.clearRevealedCommentSelection();
            },
            revealComment: (comment) => this.plugin.revealComment(comment),
            getPreferredFileLeaf: () => this.plugin.getPreferredFileLeaf(),
            openLinkText: (href, sourcePath) => this.app.workspace.openLinkText(href, sourcePath, false),
        });
        this.draftEditorController = new SidebarDraftEditorController({
            getAllIndexedComments: () => this.plugin.getAllIndexedComments(),
            updateDraftCommentText: (commentId, commentText) => {
                this.plugin.updateDraftCommentText(commentId, commentText);
            },
            renderComments: () => this.renderComments(),
            scheduleDraftFocus: (commentId) => this.interactionController.scheduleDraftFocus(commentId),
            openLinkSuggestModal: (options) => {
                new SideNoteLinkSuggestModal(this.app, options).open();
            },
            openTagSuggestModal: (options) => {
                new SideNoteTagSuggestModal(this.app, options).open();
            },
        });
    }

    getViewType() {
        return "sidenote2-view";
    }

    getDisplayText() {
        return "SideNote2";
    }

    getIcon() {
        return SIDE_NOTE2_ICON_ID;
    }

    async onOpen() {
        await Promise.resolve();
        if (!this.file) {
            this.file = this.plugin.getSidebarTargetFile();
        }
        await this.renderComments();
        document.addEventListener("keydown", this.interactionController.documentKeydownHandler, true);
        document.addEventListener("copy", this.interactionController.documentCopyHandler, true);
        document.addEventListener("selectionchange", this.interactionController.documentSelectionChangeHandler);
        this.containerEl.addEventListener("click", this.interactionController.sidebarClickHandler);
    }

    async setState(state: CustomViewState, result: ViewStateResult): Promise<void> {
        if (state.filePath) {
            const file = this.app.vault.getAbstractFileByPath(state.filePath);
            if (file instanceof TFile) {
                this.file = file;
                await this.renderComments();
            }
        }
        await super.setState(state, result);
    }

    public async updateActiveFile(file: TFile | null) {
        this.file = file;
        await this.renderComments();
    }

    public highlightComment(commentId: string) {
        this.interactionController.highlightComment(commentId);
    }

    public async highlightAndFocusDraft(commentId: string) {
        await this.interactionController.highlightAndFocusDraft(commentId);
    }

    public async focusDraft(commentId: string) {
        await this.interactionController.focusDraft(commentId);
    }

    public clearActiveState(): void {
        this.interactionController.clearActiveState();
    }

    public async renderComments() {
        const renderVersion = ++this.renderVersion;
        const file = this.file;
        const isAllCommentsView = !!file && this.plugin.isAllCommentsNotePath(file.path);

        this.containerEl.empty();
        this.containerEl.addClass("sidenote2-view-container");
        if (file) {
            if (isAllCommentsView) {
                await this.plugin.ensureIndexedCommentsLoaded();
            } else {
                await this.plugin.loadCommentsForFile(file);
            }
            if (renderVersion !== this.renderVersion || this.file?.path !== file.path) {
                return;
            }

            this.containerEl.empty();
            this.containerEl.addClass("sidenote2-view-container");
            const persistedComments = isAllCommentsView
                ? this.plugin.getAllIndexedComments()
                : this.plugin.commentManager.getCommentsForFile(file.path);
            const draftComment = this.plugin.getDraftForView(file.path);
            const resolvedCount = persistedComments.filter((comment) => comment.resolved).length;
            const hasResolvedComments = resolvedCount > 0;
            const showResolved = this.plugin.shouldShowResolvedComments();
            const commentsForFile = getSidebarComments(persistedComments, draftComment, showResolved);
            const commentsContainer = this.containerEl.createDiv("sidenote2-comments-container");

            this.renderSidebarToolbar(commentsContainer, resolvedCount, hasResolvedComments);

            const sections = buildSidebarSections(commentsForFile);
            for (const section of sections) {
                const sectionBody = this.renderCommentSection(
                    commentsContainer,
                    section.key,
                    section.title,
                    section.key === "page" && !isAllCommentsView
                        ? {
                            icon: "plus",
                            ariaLabel: "Add page side note",
                            title: "Add page side note",
                            onClick: () => {
                                void this.plugin.startPageCommentDraft(file);
                            },
                        }
                        : undefined,
                );
                const renderPromises = section.comments.map(async (comment) => {
                    if (isDraftComment(comment)) {
                        this.renderDraftComment(sectionBody, comment);
                        return;
                    }

                    await this.renderPersistedComment(sectionBody, comment);
                });
                await Promise.all(renderPromises);
            }

            if (commentsForFile.length === 0) {
                const anchoredSectionBody = commentsContainer.querySelector(
                    '[data-section-key="anchored"] .sidenote2-comment-section-body',
                );
                if (anchoredSectionBody instanceof HTMLDivElement) {
                    if (isAllCommentsView) {
                        const emptyStateEl = anchoredSectionBody.createDiv("sidenote2-empty-state sidenote2-section-empty-state");
                        emptyStateEl.createEl("p", { text: "No side notes in the index yet." });
                        emptyStateEl.createEl("p", { text: "Add side notes in markdown files to populate SideNote2 index." });
                    } else if (hasResolvedComments && !showResolved) {
                        const emptyStateEl = anchoredSectionBody.createDiv("sidenote2-empty-state sidenote2-section-empty-state");
                        emptyStateEl.createEl("p", { text: "No active comments for this file." });
                        emptyStateEl.createEl("p", { text: "Turn on Show resolved to review archived comments." });
                    }
                }
            }
        } else {
            const emptyStateEl = this.containerEl.createDiv("sidenote2-empty-state");
            emptyStateEl.createEl("p", { text: "No file selected." });
            emptyStateEl.createEl("p", { text: "Open a file to see its comments." });
        }
    }

    private renderSidebarToolbar(
        container: HTMLElement,
        resolvedCount: number,
        hasResolvedComments: boolean,
    ) {
        if (!hasResolvedComments) {
            return;
        }

        const toolbarEl = container.createDiv("sidenote2-sidebar-toolbar");
        const showResolved = this.plugin.shouldShowResolvedComments();
        const toggleButton = toolbarEl.createEl("button", {
            cls: `sidenote2-filter-chip${showResolved ? " is-active" : ""}`,
        });
        toggleButton.setAttribute("type", "button");
        toggleButton.setAttribute("aria-pressed", showResolved ? "true" : "false");
        toggleButton.setAttribute(
            "aria-label",
            showResolved ? "Hide resolved comments" : "Show resolved comments"
        );
        toggleButton.setAttribute(
            "title",
            showResolved ? "Hide resolved comments" : "Show resolved comments"
        );

        toggleButton.createSpan({
            cls: "sidenote2-filter-chip-indicator",
        });

        toggleButton.createSpan({
            text: "Resolved",
            cls: "sidenote2-filter-chip-label",
        });

        toggleButton.createSpan({
            text: String(resolvedCount),
            cls: "sidenote2-filter-chip-count",
        });

        toggleButton.onclick = () => {
            this.plugin.setShowResolvedComments(!showResolved);
        };
    }

    private renderCommentSection(
        container: HTMLElement,
        key: SidebarSectionKey,
        title: string,
        action?: {
            icon: string;
            ariaLabel: string;
            title: string;
            onClick: () => void;
        },
    ): HTMLDivElement {
        const sectionEl = container.createDiv("sidenote2-comment-section");
        sectionEl.setAttribute("data-section-key", key);
        const sectionHeader = sectionEl.createDiv("sidenote2-comment-section-header");

        const toggleButton = sectionHeader.createEl("button", {
            cls: "sidenote2-comment-section-toggle",
        });
        toggleButton.setAttribute("type", "button");

        const toggleIconEl = toggleButton.createSpan("sidenote2-comment-section-toggle-icon");
        toggleButton.createSpan({
            text: title,
            cls: "sidenote2-comment-section-title",
        });

        const sectionBody = sectionEl.createDiv("sidenote2-comment-section-body");
        const syncExpandedState = () => {
            const expanded = this.sectionExpandedState[key];
            toggleButton.setAttribute("aria-expanded", expanded ? "true" : "false");
            toggleButton.setAttribute(
                "title",
                `${expanded ? "Collapse" : "Expand"} ${title.toLowerCase()}`,
            );
            setIcon(toggleIconEl, expanded ? "chevron-down" : "chevron-right");
            sectionEl.classList.toggle("is-collapsed", !expanded);
        };

        toggleButton.onclick = (event) => {
            event.stopPropagation();
            this.sectionExpandedState[key] = !this.sectionExpandedState[key];
            syncExpandedState();
        };

        if (action) {
            const actionButton = sectionHeader.createEl("button", {
                cls: "sidenote2-comment-section-add-button",
            });
            actionButton.setAttribute("type", "button");
            actionButton.setAttribute("aria-label", action.ariaLabel);
            actionButton.setAttribute("title", action.title);
            setIcon(actionButton, action.icon);
            actionButton.onclick = (event) => {
                event.stopPropagation();
                action.onClick();
            };
        }

        syncExpandedState();
        return sectionBody;
    }

    private async renderPersistedComment(commentsContainer: HTMLDivElement, comment: Comment) {
        await renderPersistedCommentCard(commentsContainer, comment, {
            activeCommentId: this.interactionController.getActiveCommentId(),
            currentFilePath: this.file?.path ?? null,
            getEventTargetElement: (target) => this.interactionController.getEventTargetElement(target),
            isSelectionInsideSidebarContent: (selection) => this.interactionController.isSelectionInsideSidebarContent(selection),
            claimSidebarInteractionOwnership: (focusTarget) => this.interactionController.claimSidebarInteractionOwnership(focusTarget),
            renderMarkdown: async (markdown, container, sourcePath) => {
                await MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, this.plugin);
            },
            openSidebarInternalLink: (href, sourcePath, focusTarget) =>
                this.interactionController.openSidebarInternalLink(href, sourcePath, focusTarget),
            openCommentInEditor: (persistedComment) => this.interactionController.openCommentInEditor(persistedComment),
            resolveComment: (commentId) => {
                void this.plugin.resolveComment(commentId);
            },
            unresolveComment: (commentId) => {
                void this.plugin.unresolveComment(commentId);
            },
            startEditDraft: (commentId, hostFilePath) => {
                void this.plugin.startEditDraft(commentId, hostFilePath);
            },
            deleteCommentWithConfirm: (commentId) => {
                void this.deleteCommentWithConfirm(commentId);
            },
            setIcon: (element, icon) => {
                setIcon(element, icon);
            },
        });
    }

    private renderDraftComment(commentsContainer: HTMLDivElement, comment: DraftComment) {
        renderDraftCommentCard(commentsContainer, comment, {
            activeCommentId: this.interactionController.getActiveCommentId(),
            isSavingDraft: (commentId) => this.plugin.isSavingDraft(commentId),
            updateDraftCommentText: (commentId, commentText) => {
                this.plugin.updateDraftCommentText(commentId, commentText);
            },
            saveDraft: (commentId) => {
                void this.plugin.saveDraft(commentId);
            },
            cancelDraft: (commentId) => {
                void this.plugin.cancelDraft(commentId);
            },
        }, this.draftEditorController);
    }

    getState(): CustomViewState {
        return {
            filePath: this.file ? this.file.path : null,
        };
    }

    onunload() {
        document.removeEventListener("keydown", this.interactionController.documentKeydownHandler, true);
        document.removeEventListener("copy", this.interactionController.documentCopyHandler, true);
        document.removeEventListener("selectionchange", this.interactionController.documentSelectionChangeHandler);
        this.containerEl.removeEventListener("click", this.interactionController.sidebarClickHandler);
        this.interactionController.clearPendingFocus();
    }

    private async deleteCommentWithConfirm(commentId: string) {
        if (await this.plugin.shouldConfirmDelete()) {
            new ConfirmDeleteModal(this.app, () => {
                void this.plugin.deleteComment(commentId);
            }).open();
            return;
        }

        await this.plugin.deleteComment(commentId);
    }
}
