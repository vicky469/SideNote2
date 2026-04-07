import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { parseNoteComments, serializeNoteComments } from "../src/core/storage/noteCommentStorage";
import type { Comment } from "../src/commentManager";

const execFile = promisify(execFileCallback);

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: "comment-1",
        filePath: "note.md",
        startLine: 1,
        startChar: 2,
        endLine: 1,
        endChar: 7,
        selectedText: "hello",
        selectedTextHash: "hash-1",
        comment: "Original body",
        timestamp: 1710000000000,
        resolved: false,
        ...overrides,
    };
}

test("append-note-comment-entry script appends a new entry to the targeted thread", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-comment-append-script-"));
    const notePath = path.join(tempDir, "note.md");
    const commentPath = path.join(tempDir, "reply.md");
    const scriptPath = path.resolve(process.cwd(), "scripts/append-note-comment-entry.mjs");
    const original = serializeNoteComments("# Title\n\nBody text.\n", [createComment()]);

    await writeFile(notePath, original, "utf8");
    await writeFile(commentPath, "Reply body\nSecond line\n", "utf8");

    const { stdout } = await execFile("node", [
        scriptPath,
        "--file",
        notePath,
        "--id",
        "comment-1",
        "--comment-file",
        commentPath,
    ], {
        cwd: process.cwd(),
    });

    assert.match(stdout, /Appended a new entry to comment comment-1/);

    const updated = await readFile(notePath, "utf8");
    const parsed = parseNoteComments(updated, notePath);
    assert.equal(parsed.comments.length, 1);
    assert.equal(parsed.comments[0].comment, "Reply body\nSecond line");
    assert.equal(parsed.threads[0].entries.length, 2);
    assert.equal(parsed.threads[0].entries[0].body, "Original body");
    assert.equal(parsed.threads[0].entries[1].body, "Reply body\nSecond line");
    assert.equal(parsed.mainContent, "# Title\n\nBody text.");
});
