import type { Comment, CommentThread } from "../commentManager";
import { cloneCommentThreads, commentToThread, threadToComment, cloneCommentThread } from "../commentManager";

function isThreadLike(value: Comment | CommentThread): value is CommentThread {
    return Array.isArray((value as CommentThread).entries);
}

function toThreads(items: Array<Comment | CommentThread>): CommentThread[] {
    return items.map((item) => isThreadLike(item) ? cloneCommentThread(item) : commentToThread(item));
}

export class AggregateCommentIndex {
    private threadsByFile = new Map<string, CommentThread[]>();

    updateFile(filePath: string, items: Array<Comment | CommentThread>): void {
        if (!items.length) {
            this.threadsByFile.delete(filePath);
            return;
        }

        this.threadsByFile.set(filePath, toThreads(items));
    }

    renameFile(oldPath: string, newPath: string): void {
        const threads = this.threadsByFile.get(oldPath);
        this.threadsByFile.delete(oldPath);
        if (!threads?.length) {
            return;
        }

        this.threadsByFile.set(
            newPath,
            threads.map((thread) => ({
                ...cloneCommentThread(thread),
                filePath: newPath,
            })),
        );
    }

    deleteFile(filePath: string): void {
        this.threadsByFile.delete(filePath);
    }

    getAllThreads(): CommentThread[] {
        return Array.from(this.threadsByFile.values()).flatMap((threads) => cloneCommentThreads(threads));
    }

    getThreadsForFile(filePath: string): CommentThread[] {
        return cloneCommentThreads(this.threadsByFile.get(filePath) ?? []);
    }

    getThreadById(threadId: string): CommentThread | null {
        for (const threads of this.threadsByFile.values()) {
            const thread = threads.find((entry) => entry.id === threadId);
            if (thread) {
                return cloneCommentThread(thread);
            }
        }

        return null;
    }

    getAllComments(): Comment[] {
        return this.getAllThreads().map((thread) => threadToComment(thread));
    }

    getCommentById(commentId: string): Comment | null {
        const thread = this.getThreadById(commentId);
        return thread ? threadToComment(thread) : null;
    }
}
