export interface WorkspaceFileTargets<T> {
    activeMarkdownFile: T | null;
    activeSidebarFile: T | null;
    sidebarFile: T | null;
}

export function resolveWorkspaceFileTargets<T>(
    file: T | null,
    activeMarkdownFile: T | null,
    isMarkdownCommentableFile: (file: T | null) => file is T,
    isSidebarSupportedFile: (file: T | null) => file is T,
): WorkspaceFileTargets<T> {
    const nextActiveMarkdownFile = isMarkdownCommentableFile(file)
        ? file
        : activeMarkdownFile;
    const nextActiveSidebarFile = isSidebarSupportedFile(file)
        ? file
        : null;

    return {
        activeMarkdownFile: nextActiveMarkdownFile,
        activeSidebarFile: nextActiveSidebarFile,
        sidebarFile: nextActiveSidebarFile,
    };
}

export function shouldIgnoreWorkspaceLeafChange(viewType: string | null): boolean {
    return viewType === "sidenote2-view";
}

export function resolveIndexLeafMode(options: {
    isMarkdownLeaf: boolean;
    isIndexLeaf: boolean;
    currentMode: string;
    sourceFlag?: boolean;
}): "preview" | "source" | null {
    if (!options.isMarkdownLeaf) {
        return null;
    }

    if (options.isIndexLeaf) {
        return options.currentMode === "preview" ? null : "preview";
    }

    const isDefaultEditingMode = options.currentMode === "source" && options.sourceFlag !== true;
    return isDefaultEditingMode ? null : "source";
}
