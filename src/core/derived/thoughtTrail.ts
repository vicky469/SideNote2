import type { Comment } from "../../commentManager";
import { getCommentSelectionLabel, getCommentStatusLabel, isAnchoredComment, isPageComment } from "../anchors/commentAnchors";
import { sortCommentsByPosition } from "../storage/noteCommentStorage";
import { extractWikiLinks } from "../text/commentMentions";

const ALL_COMMENTS_NOTE_PATH = "SideNote2 index.md";
const LEGACY_ALL_COMMENTS_NOTE_PATH = "SideNote2 comments.md";
const MAX_PREVIEW_LENGTH = 80;
const DEFAULT_CONNECTED_CHAIN_DEPTH = 2;

export interface ThoughtTrailBuildOptions {
    allCommentsNotePath?: string;
    resolveWikiLinkPath?: (linkPath: string, sourceFilePath: string) => string | null;
    connectedChainDepth?: number;
}

interface ThoughtTrailEdge {
    comment: Comment;
    targetFilePath: string;
    targetLabel: string;
}

function normalizeNotePath(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    const normalizedParts: string[] = [];

    for (const part of parts) {
        if (!part || part === ".") {
            continue;
        }

        if (part === "..") {
            normalizedParts.pop();
            continue;
        }

        normalizedParts.push(part);
    }

    return normalizedParts.join("/");
}

function isAllCommentsNotePath(filePath: string, currentPath: string = ALL_COMMENTS_NOTE_PATH): boolean {
    return filePath === normalizeNotePath(currentPath) || filePath === LEGACY_ALL_COMMENTS_NOTE_PATH;
}

function normalizeConnectedChainDepth(value: number | null | undefined): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_CONNECTED_CHAIN_DEPTH;
    }

    return Math.max(1, Math.floor(value ?? DEFAULT_CONNECTED_CHAIN_DEPTH));
}

function toInlinePreview(value: string): string {
    const normalized = value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    if (!normalized) {
        return "(blank selection)";
    }

    if (normalized.length <= MAX_PREVIEW_LENGTH) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 3).trimEnd()}...`;
}

function escapeMarkdownText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/([`*_[\]()~<>])/g, "\\$1");
}

function formatFileHeadingLabel(filePath: string): string {
    return escapeMarkdownText(filePath);
}

function formatCommentLinkLabel(comment: Comment, mentionedPageLabel?: string, pageNoteOrdinal?: number): string {
    const selectedPreview = escapeMarkdownText(toInlinePreview(getCommentSelectionLabel(comment)));
    const normalizedMentionLabel = mentionedPageLabel
        ? escapeMarkdownText(toInlinePreview(mentionedPageLabel))
        : null;
    const pageNoteFallbackLabel = pageNoteOrdinal ? String(pageNoteOrdinal) : selectedPreview;
    const prefixedPreview = isAnchoredComment(comment)
        ? (normalizedMentionLabel ? `${selectedPreview} · ${normalizedMentionLabel}` : selectedPreview)
        : `${getCommentStatusLabel(comment)} · ${normalizedMentionLabel ?? (isPageComment(comment) ? pageNoteFallbackLabel : selectedPreview)}`;
    if (comment.resolved) {
        return `~~${prefixedPreview}~~`;
    }

    return prefixedPreview;
}

function buildEdgesBySourceFile(
    commentsByFile: Map<string, Comment[]>,
    options: ThoughtTrailBuildOptions,
): Map<string, ThoughtTrailEdge[]> {
    const resolveWikiLinkPath = options.resolveWikiLinkPath;
    if (!resolveWikiLinkPath) {
        return new Map();
    }

    const edgesBySourceFile = new Map<string, ThoughtTrailEdge[]>();
    for (const filePath of Array.from(commentsByFile.keys()).sort((left, right) => left.localeCompare(right))) {
        const fileComments = sortCommentsByPosition(commentsByFile.get(filePath) ?? []);
        const edges: ThoughtTrailEdge[] = [];

        for (const comment of fileComments) {
            const seenTargets = new Set<string>();

            for (const match of extractWikiLinks(comment.comment ?? "")) {
                const resolvedPath = resolveWikiLinkPath(match.linkPath, comment.filePath);
                if (!resolvedPath || resolvedPath === comment.filePath || isAllCommentsNotePath(resolvedPath, options.allCommentsNotePath)) {
                    continue;
                }

                if (seenTargets.has(resolvedPath)) {
                    continue;
                }

                seenTargets.add(resolvedPath);
                edges.push({
                    comment,
                    targetFilePath: resolvedPath,
                    targetLabel: toInlinePreview(match.displayText?.trim() || match.linkPath.trim()),
                });
            }
        }

        if (edges.length) {
            edgesBySourceFile.set(filePath, edges);
        }
    }

    return edgesBySourceFile;
}

function getOrderedRoots(edgesBySourceFile: Map<string, ThoughtTrailEdge[]>): string[] {
    const sourceFilePaths = Array.from(edgesBySourceFile.keys()).sort((left, right) => left.localeCompare(right));
    const incomingCounts = new Map<string, number>();
    for (const edges of edgesBySourceFile.values()) {
        for (const edge of edges) {
            incomingCounts.set(edge.targetFilePath, (incomingCounts.get(edge.targetFilePath) ?? 0) + 1);
        }
    }

    const orderedRoots: string[] = [];
    const coveredSources = new Set<string>();
    const markReachableSources = (rootFilePath: string): void => {
        const pending = [rootFilePath];

        while (pending.length) {
            const currentFilePath = pending.pop();
            if (!currentFilePath || coveredSources.has(currentFilePath)) {
                continue;
            }

            coveredSources.add(currentFilePath);
            for (const edge of edgesBySourceFile.get(currentFilePath) ?? []) {
                if (edgesBySourceFile.has(edge.targetFilePath) && !coveredSources.has(edge.targetFilePath)) {
                    pending.push(edge.targetFilePath);
                }
            }
        }
    };

    for (const filePath of sourceFilePaths) {
        if (incomingCounts.has(filePath)) {
            continue;
        }

        orderedRoots.push(filePath);
        markReachableSources(filePath);
    }

    for (const filePath of sourceFilePaths) {
        if (coveredSources.has(filePath)) {
            continue;
        }

        orderedRoots.push(filePath);
        markReachableSources(filePath);
    }

    return orderedRoots;
}

export function buildThoughtTrailLines(
    vaultName: string,
    comments: Comment[],
    options: ThoughtTrailBuildOptions = {},
): string[] {
    const visibleComments = comments.filter((comment) => !isAllCommentsNotePath(comment.filePath, options.allCommentsNotePath));
    if (!visibleComments.length) {
        return [];
    }

    const commentsByFile = new Map<string, Comment[]>();
    for (const comment of visibleComments) {
        const existing = commentsByFile.get(comment.filePath);
        if (existing) {
            existing.push(comment);
        } else {
            commentsByFile.set(comment.filePath, [comment]);
        }
    }

    const edgesBySourceFile = buildEdgesBySourceFile(commentsByFile, options);
    if (!edgesBySourceFile.size) {
        return [];
    }

    const maxDepth = normalizeConnectedChainDepth(options.connectedChainDepth);
    const lines: string[] = [];

    const renderBranch = (
        sourceFilePath: string,
        depth: number,
        branchVisited: Set<string>,
    ): void => {
        if (depth > maxDepth) {
            return;
        }

        for (const edge of edgesBySourceFile.get(sourceFilePath) ?? []) {
            const label = formatCommentLinkLabel(edge.comment, edge.targetLabel);
            const isCycle = branchVisited.has(edge.targetFilePath);
            lines.push(
                `${"  ".repeat(depth)}- [${label}](obsidian://side-note2-comment?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(edge.comment.filePath)}&commentId=${encodeURIComponent(edge.comment.id)}) -> **${formatFileHeadingLabel(edge.targetFilePath)}**${isCycle ? " (cycle)" : ""}`,
            );

            if (isCycle || depth >= maxDepth || !edgesBySourceFile.has(edge.targetFilePath)) {
                continue;
            }

            branchVisited.add(edge.targetFilePath);
            renderBranch(edge.targetFilePath, depth + 1, branchVisited);
            branchVisited.delete(edge.targetFilePath);
        }
    };

    for (const rootFilePath of getOrderedRoots(edgesBySourceFile)) {
        lines.push(`- **${formatFileHeadingLabel(rootFilePath)}**`);
        renderBranch(rootFilePath, 1, new Set([rootFilePath]));
        lines.push("");
    }

    if (lines[lines.length - 1] === "") {
        lines.pop();
    }

    return lines;
}
