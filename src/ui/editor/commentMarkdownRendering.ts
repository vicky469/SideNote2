import { shortenBareUrlsInMarkdown } from "../../core/text/commentUrls";

const DASH_RULE_LINE = /^ {0,3}-(?:[ \t]*-){2,}[ \t]*$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM_LINE = /^(\s{0,3})([-+*]|\d+[.)]|[A-Za-z][.)])[ \t]+/;
const LIST_CONTINUATION_BLOCK_BOUNDARY_LINE = /^ {0,3}(?:#{1,6}(?:[ \t]|$)|>[ \t]?)/;

type FenceState = {
    marker: "`" | "~";
    length: number;
};

type ListState = {
    continuationIndent: string;
    pendingIndentedContinuation: boolean;
};

function parseFenceState(line: string): FenceState | null {
    const match = line.match(FENCE_LINE);
    if (!match) {
        return null;
    }

    const markerSequence = match[1];
    return {
        marker: markerSequence[0] as "`" | "~",
        length: markerSequence.length,
    };
}

function isClosingFence(line: string, fenceState: FenceState): boolean {
    const trimmed = line.trim();
    if (!trimmed) {
        return false;
    }

    if (trimmed[0] !== fenceState.marker) {
        return false;
    }

    const markerRun = trimmed.match(/^(`+|~+)/)?.[1] ?? "";
    return markerRun.length >= fenceState.length
        && markerRun.split("").every((char) => char === fenceState.marker)
        && trimmed.slice(markerRun.length).trim().length === 0;
}

function getListContinuationIndent(line: string): string | null {
    const match = line.match(LIST_ITEM_LINE);
    if (!match) {
        return null;
    }

    const [, leadingWhitespace, marker] = match;
    return leadingWhitespace + " ".repeat(marker.length + 1);
}

function shouldKeepLineOutsideListContinuation(line: string): boolean {
    return DASH_RULE_LINE.test(line) || FENCE_LINE.test(line) || LIST_CONTINUATION_BLOCK_BOUNDARY_LINE.test(line);
}

function countLeadingWhitespace(line: string): number {
    return line.match(/^[ \t]*/)?.[0].length ?? 0;
}

export function normalizeCommentMarkdownForRender(markdown: string): string {
    if (!markdown) {
        return markdown;
    }

    const lines = shortenBareUrlsInMarkdown(markdown).split("\n");
    const normalized: string[] = [];
    let activeFence: FenceState | null = null;
    let activeList: ListState | null = null;

    for (const line of lines) {
        if (activeFence) {
            normalized.push(line);
            if (isClosingFence(line, activeFence)) {
                activeFence = null;
            }
            continue;
        }

        const fenceState = parseFenceState(line);
        if (fenceState) {
            normalized.push(line);
            activeFence = fenceState;
            continue;
        }

        const listContinuationIndent = getListContinuationIndent(line);
        if (listContinuationIndent) {
            normalized.push(line);
            activeList = {
                continuationIndent: listContinuationIndent,
                pendingIndentedContinuation: false,
            };
            continue;
        }

        if (activeList) {
            if (line.trim().length === 0) {
                normalized.push(line);
                activeList.pendingIndentedContinuation = true;
                continue;
            }

            if (activeList.pendingIndentedContinuation) {
                if (shouldKeepLineOutsideListContinuation(line)) {
                    activeList = null;
                } else {
                    const leadingWhitespace = countLeadingWhitespace(line);
                    if (leadingWhitespace < activeList.continuationIndent.length) {
                        normalized.push(activeList.continuationIndent + line.slice(leadingWhitespace));
                    } else {
                        normalized.push(line);
                    }
                    activeList.pendingIndentedContinuation = false;
                    continue;
                }
            }
        }

        if (
            DASH_RULE_LINE.test(line)
            && normalized.length > 0
            && normalized[normalized.length - 1].trim().length > 0
        ) {
            normalized.push("");
        }

        normalized.push(line);
    }

    return normalized.join("\n");
}
