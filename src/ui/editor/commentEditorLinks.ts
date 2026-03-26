import type { TextEditResult } from "./commentEditorFormatting";

export interface WikiLinkQueryMatch {
    start: number;
    end: number;
    query: string;
}

export function findOpenWikiLinkQuery(
    value: string,
    selectionStart: number,
    selectionEnd: number,
): WikiLinkQueryMatch | null {
    if (selectionStart !== selectionEnd) {
        return null;
    }

    const caret = selectionStart;
    const prefix = value.slice(0, caret);
    const start = prefix.lastIndexOf("[[");
    if (start === -1) {
        return null;
    }

    const priorClose = prefix.lastIndexOf("]]");
    if (priorClose > start) {
        return null;
    }

    const query = value.slice(start + 2, caret);
    if (query.includes("\n")) {
        return null;
    }

    return {
        start,
        end: caret,
        query,
    };
}

export function replaceOpenWikiLinkQuery(
    value: string,
    match: WikiLinkQueryMatch,
    replacement: string,
): TextEditResult {
    const nextValue = value.slice(0, match.start) + replacement + value.slice(match.end);
    const cursor = match.start + replacement.length;
    return {
        value: nextValue,
        selectionStart: cursor,
        selectionEnd: cursor,
    };
}
