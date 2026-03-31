import { isTagCharacter } from "../../core/text/commentTags";
import type { TextEditResult } from "./commentEditorFormatting";

export interface TagQueryMatch {
    start: number;
    end: number;
    query: string;
}

function isTagBoundaryChar(char: string): boolean {
    return !char || !isTagCharacter(char);
}

export function findOpenTagQuery(
    value: string,
    selectionStart: number,
    selectionEnd: number,
): TagQueryMatch | null {
    if (selectionStart !== selectionEnd) {
        return null;
    }

    let queryStart = selectionStart;
    while (queryStart > 0 && isTagCharacter(value.charAt(queryStart - 1))) {
        queryStart -= 1;
    }

    const hashIndex = queryStart - 1;
    if (hashIndex < 0 || value.charAt(hashIndex) !== "#") {
        return null;
    }

    if (!isTagBoundaryChar(value.charAt(hashIndex - 1))) {
        return null;
    }

    return {
        start: hashIndex,
        end: selectionStart,
        query: value.slice(queryStart, selectionStart),
    };
}

export function replaceOpenTagQuery(
    value: string,
    match: TagQueryMatch,
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
