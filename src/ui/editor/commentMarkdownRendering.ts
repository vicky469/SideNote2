import { shortenBareUrlsInMarkdown } from "../../core/text/commentUrls";
import {
    buildSideNoteReferenceMarkdown,
    replaceRawSideNoteReferenceUrls,
    type RawSideNoteReferenceMatch,
} from "../../core/text/commentReferences";
import {
    isMarkdownListLine,
    toggleMarkdownLinesContentWrap,
} from "./markdownLineWrapping";

const DASH_RULE_LINE = /^ {0,3}-(?:[ \t]*-){2,}[ \t]*$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const DISPLAY_MATH_OPEN_LINE = /^(\s*)\\\[\s*$/;
const DISPLAY_MATH_CLOSE_LINE = /^(\s*)\\\]\s*$/;

type FenceState = {
    marker: "`" | "~";
    length: number;
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

function replaceLatexMathDelimitersOutsideInlineCode(line: string): string {
    let result = "";
    let cursor = 0;

    while (cursor < line.length) {
        const backtickStart = line.indexOf("`", cursor);
        const segmentEnd = backtickStart === -1 ? line.length : backtickStart;
        const plainSegment = line.slice(cursor, segmentEnd)
            .replace(/\\\((.+?)\\\)/g, (_match, content: string) => `$${content}$`)
            .replace(/\\\[(.+?)\\\]/g, (_match, content: string) => `$$${content}$$`);
        result += plainSegment;

        if (backtickStart === -1) {
            break;
        }

        let fenceLength = 1;
        while (line[backtickStart + fenceLength] === "`") {
            fenceLength += 1;
        }
        const fence = "`".repeat(fenceLength);
        const backtickEnd = line.indexOf(fence, backtickStart + fenceLength);
        if (backtickEnd === -1) {
            result += line.slice(backtickStart);
            break;
        }

        result += line.slice(backtickStart, backtickEnd + fenceLength);
        cursor = backtickEnd + fenceLength;
    }

    return result;
}

function normalizePreparedCommentMarkdownForRender(markdown: string): string {
    if (!markdown) {
        return markdown;
    }

    const lines = normalizeStandaloneMultilineBoldListBlocks(shortenBareUrlsInMarkdown(markdown)).split("\n");
    const normalized: string[] = [];
    let activeFence: FenceState | null = null;

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

        const displayMathOpenMatch = line.match(DISPLAY_MATH_OPEN_LINE);
        if (displayMathOpenMatch) {
            normalized.push(`${displayMathOpenMatch[1]}$$`);
            continue;
        }

        const displayMathCloseMatch = line.match(DISPLAY_MATH_CLOSE_LINE);
        if (displayMathCloseMatch) {
            normalized.push(`${displayMathCloseMatch[1]}$$`);
            continue;
        }

        const normalizedLine = replaceLatexMathDelimitersOutsideInlineCode(line);
        if (
            DASH_RULE_LINE.test(normalizedLine)
            && normalized.length > 0
            && normalized[normalized.length - 1].trim().length > 0
        ) {
            normalized.push("");
        }

        normalized.push(normalizedLine);
    }

    return normalized.join("\n");
}

function normalizeStandaloneMultilineBoldListBlocks(markdown: string): string {
    const lines = markdown.split("\n");
    const normalized: string[] = [];
    let activeFence: FenceState | null = null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
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

        const openMatch = line.match(/^(\s*)\*\*(.*)$/);
        if (!openMatch || openMatch[2].includes("**")) {
            normalized.push(line);
            continue;
        }

        const blockLines = [openMatch[2]];
        let endIndex = -1;
        for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
            const closeMatch = lines[nextIndex].match(/^(.*)\*\*(\s*)$/);
            if (closeMatch) {
                blockLines.push(closeMatch[1]);
                endIndex = nextIndex;
                break;
            }
            blockLines.push(lines[nextIndex]);
        }

        if (endIndex === -1 || !blockLines.some((blockLine) => isMarkdownListLine(blockLine))) {
            normalized.push(line);
            continue;
        }

        const wrappedLines = toggleMarkdownLinesContentWrap(blockLines, "**");
        normalized.push(`${openMatch[1]}${wrappedLines[0] ?? ""}`, ...wrappedLines.slice(1));
        index = endIndex;
    }

    return normalized.join("\n");
}

export interface NormalizeCommentMarkdownForRenderOptions {
    resolveSideNoteReferenceLabel?: (match: RawSideNoteReferenceMatch) => string;
}

export function normalizeCommentMarkdownForRenderWithOptions(
    markdown: string,
    options: NormalizeCommentMarkdownForRenderOptions = {},
): string {
    if (!markdown) {
        return markdown;
    }

    const normalizedSideNoteLinks = replaceRawSideNoteReferenceUrls(
        markdown,
        (match) => buildSideNoteReferenceMarkdown(
            match.url,
            options.resolveSideNoteReferenceLabel?.(match) ?? match.url,
        ),
    );

    return normalizePreparedCommentMarkdownForRender(normalizedSideNoteLinks);
}

export function normalizeCommentMarkdownForRender(markdown: string): string {
    return normalizeCommentMarkdownForRenderWithOptions(markdown);
}
