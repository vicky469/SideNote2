export type SidebarPersistedCommentPrimaryAction = "index-highlight" | "source-redirect";

export function getSidebarPersistedCommentPrimaryAction(
    currentFilePath: string | null,
    isAllCommentsNotePath: (path: string) => boolean,
): SidebarPersistedCommentPrimaryAction {
    return !!currentFilePath && isAllCommentsNotePath(currentFilePath)
        ? "index-highlight"
        : "source-redirect";
}
