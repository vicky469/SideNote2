export interface SidebarSearchHighlightRange {
    start: number;
    end: number;
}

function normalizeSidebarSearchTerms(query: string): string[] {
    const terms = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 0);

    return Array.from(new Set(terms)).sort((left, right) => right.length - left.length);
}

export function getSidebarSearchHighlightRanges(
    text: string,
    query: string,
): SidebarSearchHighlightRange[] {
    if (!text) {
        return [];
    }

    const terms = normalizeSidebarSearchTerms(query);
    if (terms.length === 0) {
        return [];
    }

    const ranges: SidebarSearchHighlightRange[] = [];
    const occupied = new Array<boolean>(text.length).fill(false);
    const lowercaseText = text.toLowerCase();

    for (const term of terms) {
        let searchFrom = 0;
        while (searchFrom < lowercaseText.length) {
            const matchIndex = lowercaseText.indexOf(term, searchFrom);
            if (matchIndex < 0) {
                break;
            }

            const matchEnd = matchIndex + term.length;
            const hasOverlap = occupied.slice(matchIndex, matchEnd).some(Boolean);
            if (!hasOverlap) {
                ranges.push({
                    start: matchIndex,
                    end: matchEnd,
                });
                occupied.fill(true, matchIndex, matchEnd);
            }

            searchFrom = matchIndex + term.length;
        }
    }

    return ranges.sort((left, right) => left.start - right.start);
}

export function highlightSidebarSearchMatches(
    container: HTMLElement,
    query: string,
): void {
    const terms = normalizeSidebarSearchTerms(query);
    if (terms.length === 0) {
        return;
    }

    const ownerDocument = container.ownerDocument;
    const nodeFilter = ownerDocument.defaultView?.NodeFilter;
    if (!nodeFilter) {
        return;
    }

    const textNodes: Text[] = [];
    const walker = ownerDocument.createTreeWalker(
        container,
        nodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (!(node instanceof Text) || !node.nodeValue?.trim()) {
                    return nodeFilter.FILTER_SKIP;
                }

                const parentEl = node.parentElement;
                if (
                    !parentEl
                    || parentEl.closest(".sidenote2-search-match")
                    || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parentEl.tagName)
                ) {
                    return nodeFilter.FILTER_SKIP;
                }

                return nodeFilter.FILTER_ACCEPT;
            },
        },
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
        if (currentNode instanceof Text) {
            textNodes.push(currentNode);
        }
        currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
        const textContent = textNode.nodeValue ?? "";
        const ranges = getSidebarSearchHighlightRanges(textContent, query);
        if (ranges.length === 0) {
            continue;
        }

        const fragment = ownerDocument.createDocumentFragment();
        let cursor = 0;
        for (const range of ranges) {
            if (range.start > cursor) {
                fragment.append(textContent.slice(cursor, range.start));
            }

            const matchEl = ownerDocument.createElement("mark");
            matchEl.className = "sidenote2-search-match";
            matchEl.textContent = textContent.slice(range.start, range.end);
            fragment.append(matchEl);
            cursor = range.end;
        }

        if (cursor < textContent.length) {
            fragment.append(textContent.slice(cursor));
        }

        textNode.parentNode?.replaceChild(fragment, textNode);
    }
}

export function clearSidebarSearchHighlights(container: HTMLElement): void {
    const marks = Array.from(container.querySelectorAll("mark.sidenote2-search-match"));
    if (marks.length === 0) {
        return;
    }

    const parents = new Set<Node>();
    for (const mark of marks) {
        const parent = mark.parentNode;
        if (!parent) {
            continue;
        }

        parent.replaceChild(container.ownerDocument.createTextNode(mark.textContent ?? ""), mark);
        parents.add(parent);
    }

    for (const parent of parents) {
        if ("normalize" in parent && typeof parent.normalize === "function") {
            parent.normalize();
        }
    }
}
