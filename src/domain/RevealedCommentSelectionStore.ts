export interface RevealedCommentState {
    filePath: string;
    commentId: string;
}

export class RevealedCommentSelectionStore {
    private revealedCommentState: RevealedCommentState | null = null;

    public getRevealedCommentState(): RevealedCommentState | null {
        return this.revealedCommentState;
    }

    public getRevealedCommentId(filePath: string): string | null {
        return this.revealedCommentState?.filePath === filePath
            ? this.revealedCommentState.commentId
            : null;
    }

    public setRevealedCommentState(filePath: string, commentId: string): boolean {
        if (
            this.revealedCommentState?.filePath === filePath
            && this.revealedCommentState.commentId === commentId
        ) {
            return false;
        }

        this.revealedCommentState = { filePath, commentId };
        return true;
    }

    public clearRevealedCommentState(): RevealedCommentState | null {
        const previousState = this.revealedCommentState;
        this.revealedCommentState = null;
        return previousState;
    }
}
