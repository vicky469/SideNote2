const MARKDOWN_LIST_LINE = /^(\s*)([-*+]\s|\d+\.\s|[a-zA-Z]+\.\s)(.*)$/;
const LEADING_WHITESPACE = /^(\s*)(.*)$/;

interface LineContentParts {
    prefix: string;
    content: string;
}

export function isMarkdownListLine(line: string): boolean {
    return MARKDOWN_LIST_LINE.test(line);
}

function splitMarkdownLineContent(line: string): LineContentParts {
    const listMatch = line.match(MARKDOWN_LIST_LINE);
    if (listMatch) {
        return {
            prefix: `${listMatch[1]}${listMatch[2]}`,
            content: listMatch[3],
        };
    }

    const whitespaceMatch = line.match(LEADING_WHITESPACE);
    return {
        prefix: whitespaceMatch?.[1] ?? "",
        content: whitespaceMatch?.[2] ?? line,
    };
}

function isWrappedContent(content: string, marker: string): boolean {
    return content.length >= marker.length * 2
        && content.startsWith(marker)
        && content.endsWith(marker);
}

export function toggleMarkdownLinesContentWrap(lines: string[], marker: string): string[] {
    const wrappableLines = lines
        .map((line) => splitMarkdownLineContent(line))
        .filter((parts) => parts.content.trim().length > 0);

    if (wrappableLines.length === 0) {
        return lines;
    }

    const shouldUnwrap = wrappableLines.every((parts) => isWrappedContent(parts.content, marker));

    return lines.map((line) => {
        const { prefix, content } = splitMarkdownLineContent(line);
        if (content.trim().length === 0) {
            return line;
        }

        if (shouldUnwrap) {
            return `${prefix}${content.slice(marker.length, content.length - marker.length)}`;
        }

        if (isWrappedContent(content, marker)) {
            return line;
        }

        return `${prefix}${marker}${content}${marker}`;
    });
}

export function getMarkdownLinesContentSelectionBounds(lines: string[], marker: string): {
    selectionStart: number;
    selectionEnd: number;
} {
    let offset = 0;
    let selectionStart: number | null = null;
    let selectionEnd = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const { prefix, content } = splitMarkdownLineContent(line);
        if (content.trim().length > 0) {
            const contentStart = offset + prefix.length;
            const startsWrapped = content.startsWith(marker);
            const endsWrapped = content.endsWith(marker);
            const lineSelectionStart = contentStart + (startsWrapped ? marker.length : 0);
            const lineSelectionEnd = contentStart + content.length - (endsWrapped ? marker.length : 0);
            selectionStart ??= lineSelectionStart;
            selectionEnd = lineSelectionEnd;
        }

        offset += line.length + (index < lines.length - 1 ? 1 : 0);
    }

    return {
        selectionStart: selectionStart ?? 0,
        selectionEnd,
    };
}
