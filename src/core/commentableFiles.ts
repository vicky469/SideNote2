import type { TFile } from "obsidian";
import { isAllCommentsNotePath } from "./allCommentsNote";

export function isMarkdownCommentablePath(filePath: string): boolean {
    return /\.md$/i.test(filePath) && !isAllCommentsNotePath(filePath);
}

export function isAttachmentCommentablePath(filePath: string): boolean {
    return /\.pdf$/i.test(filePath);
}

export function isSidebarSupportedPath(filePath: string): boolean {
    return isAllCommentsNotePath(filePath)
        || isMarkdownCommentablePath(filePath)
        || isAttachmentCommentablePath(filePath);
}

export function isMarkdownCommentableFile(file: TFile | null): file is TFile {
    return !!file && isMarkdownCommentablePath(file.path);
}

export function isAttachmentCommentableFile(file: TFile | null): file is TFile {
    return !!file && isAttachmentCommentablePath(file.path);
}

export function isSidebarSupportedFile(file: TFile | null): file is TFile {
    return !!file && isSidebarSupportedPath(file.path);
}
