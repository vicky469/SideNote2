import type { CommentThread } from "../../commentManager";
import { buildIndexFileFilterGraph } from "../../core/derived/indexFileFilterGraph";
import { deriveIndexSidebarScopedFilePaths, filterCommentsByFilePaths } from "./indexFileFilter";

export function buildRootedThoughtTrailScope(
    threads: CommentThread[],
    options: {
        rootFilePath: string;
        allCommentsNotePath: string;
        referenceAdjacency?: Map<string, Set<string>>;
        resolveWikiLinkPath: (linkPath: string, sourceFilePath: string) => string | null;
    },
): {
    scopedFilePaths: string[];
    scopedThreads: CommentThread[];
} {
    const graph = buildIndexFileFilterGraph(threads, {
        allCommentsNotePath: options.allCommentsNotePath,
        referenceAdjacency: options.referenceAdjacency,
        resolveWikiLinkPath: options.resolveWikiLinkPath,
        showResolved: null,
    });
    const scopedFilePaths = deriveIndexSidebarScopedFilePaths(graph, options.rootFilePath);

    return {
        scopedFilePaths,
        scopedThreads: scopedFilePaths.length
            ? filterCommentsByFilePaths(threads, scopedFilePaths)
            : [],
    };
}
