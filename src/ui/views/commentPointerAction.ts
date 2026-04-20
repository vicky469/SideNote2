export interface TextSelectionLike {
    isCollapsed: boolean;
    toString(): string;
}

export interface SidebarCommentPointerActionState {
    clickedInteractiveElement: boolean;
    clickedInsideCommentContent: boolean;
    selection: TextSelectionLike | null;
    selectionInsideSidebarCommentContent: boolean;
}

export interface SidebarCommentDoubleClickOpenState {
    clickedInteractiveElement: boolean;
}

export function shouldActivateSidebarComment(
    state: SidebarCommentPointerActionState,
): boolean {
    if (state.clickedInteractiveElement || state.clickedInsideCommentContent) {
        return false;
    }

    if (!state.selection) {
        return true;
    }

    if (!state.selectionInsideSidebarCommentContent) {
        return true;
    }

    return state.selection.isCollapsed && state.selection.toString().length === 0;
}

export function shouldOpenSidebarCommentOnDoubleClick(
    state: SidebarCommentDoubleClickOpenState,
): boolean {
    return !state.clickedInteractiveElement;
}
