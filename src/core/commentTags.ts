const TAG_CHARACTER_REGEX = /[\p{L}\p{N}_/-]/u;

export function isTagCharacter(char: string): boolean {
    return char.length === 1 && TAG_CHARACTER_REGEX.test(char);
}

export function normalizeTagText(value: string): string {
    const normalized = value.trim().replace(/^#+/, "");
    return normalized ? `#${normalized}` : "";
}

function isTagBoundaryChar(char: string): boolean {
    return !char || !isTagCharacter(char);
}

export function extractTagsFromText(value: string): string[] {
    const tags: string[] = [];

    for (let index = 0; index < value.length; index += 1) {
        if (value.charAt(index) !== "#") {
            continue;
        }

        if (!isTagBoundaryChar(value.charAt(index - 1))) {
            continue;
        }

        let end = index + 1;
        while (end < value.length && isTagCharacter(value.charAt(end))) {
            end += 1;
        }

        if (end === index + 1) {
            continue;
        }

        tags.push(normalizeTagText(value.slice(index, end)));
        index = end - 1;
    }

    return tags;
}
