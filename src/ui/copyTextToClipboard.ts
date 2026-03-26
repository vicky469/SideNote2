export interface ClipboardWriter {
    writeText(text: string): Promise<void>;
}

export interface CopyTextContainer {
    appendChild(node: CopyTextTextarea): void;
}

export interface CopyTextTextarea {
    value: string;
    style: {
        position: string;
        left: string;
        top: string;
        opacity: string;
        pointerEvents: string;
    };
    setAttribute(name: string, value: string): void;
    focus(): void;
    select(): void;
    setSelectionRange(start: number, end: number): void;
    remove(): void;
}

export interface CopyTextDocument {
    body?: CopyTextContainer | null;
    documentElement?: CopyTextContainer | null;
    createElement(tagName: "textarea"): CopyTextTextarea;
    execCommand(command: "copy"): boolean;
}

export interface CopyTextEnvironment {
    clipboard?: ClipboardWriter | null;
    document?: CopyTextDocument | null;
}

function getDefaultClipboard(): ClipboardWriter | null {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        return null;
    }

    return navigator.clipboard;
}

function getDefaultDocument(): CopyTextDocument | null {
    if (typeof document === "undefined") {
        return null;
    }

    return document as unknown as CopyTextDocument;
}

export async function copyTextToClipboard(
    text: string,
    environment: CopyTextEnvironment = {},
): Promise<boolean> {
    const clipboard = environment.clipboard === undefined ? getDefaultClipboard() : environment.clipboard;
    if (clipboard?.writeText) {
        try {
            await clipboard.writeText(text);
            return true;
        } catch {
            // Fall back to document.execCommand for contexts without async clipboard support.
        }
    }

    const doc = environment.document === undefined ? getDefaultDocument() : environment.document;
    if (!doc) {
        return false;
    }

    const container = doc.body ?? doc.documentElement;
    if (!container) {
        return false;
    }

    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    container.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
        return doc.execCommand("copy");
    } catch {
        return false;
    } finally {
        textarea.remove();
    }
}
