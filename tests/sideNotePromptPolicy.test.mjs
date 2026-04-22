import assert from "node:assert/strict";
import test from "node:test";
import sideNotePromptPolicy from "../shared/sideNotePromptPolicy.js";

test("buildSideNotePrompt applies the provided root label and path", () => {
    const prompt = sideNotePromptPolicy.buildSideNotePrompt({
        promptText: "@codex generate a math diagram",
        rootLabel: "workspace root",
        rootPath: "/vault",
    });

    assert.match(prompt, /Attachments\/` at the active workspace root/i);
    assert.match(prompt, /The active workspace root is: \/vault/);
});

test("buildSideNotePrompt falls back cleanly when no root path is provided", () => {
    const prompt = sideNotePromptPolicy.buildSideNotePrompt({
        promptText: "@codex explain this",
        rootLabel: "vault root",
    });

    assert.match(prompt, /Attachments\/` at the active vault root/i);
    assert.doesNotMatch(prompt, /The active vault root is:/);
});
