export interface EditDismissalDecision {
    shouldSaveDraft: boolean;
    shouldClearActiveState: boolean;
    shouldClearRevealedCommentSelection: boolean;
}

export function decideEditDismissal(
    _clickedInsideDraft: boolean,
    _clickedCommentItem: boolean,
    _clickedSectionChrome: boolean,
): EditDismissalDecision {
    return {
        shouldSaveDraft: false,
        shouldClearActiveState: false,
        shouldClearRevealedCommentSelection: false,
    };
}
