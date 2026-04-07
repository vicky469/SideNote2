import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { parseNoteComments, serializeNoteComments } from "../src/core/storage/noteCommentStorage";
import type { Comment } from "../src/commentManager";

const execFile = promisify(execFileCallback);

async function writeObsidianVaultConfig(homeDir: string, vaultRoot: string): Promise<void> {
    const configPath = path.join(homeDir, ".config", "obsidian", "obsidian.json");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({
        vaults: {
            "vault-1": {
                path: vaultRoot,
            },
        },
    }, null, 2), "utf8");
}

function buildCommentLocationUri(vaultName: string, filePath: string, commentId: string): string {
    return `obsidian://side-note2-comment?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}&commentId=${encodeURIComponent(commentId)}`;
}

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

test("comment:resolve marks the targeted thread resolved", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-comment-resolve-script-"));
    const notePath = path.join(tempDir, "note.md");
    const scriptPath = path.resolve(process.cwd(), "bin/sidenote2.mjs");
    const original = serializeNoteComments("# Title\n\nBody text.\n", [createComment()]);

    await writeFile(notePath, original, "utf8");

    const { stdout } = await execFile("node", [
        scriptPath,
        "comment:resolve",
        "--file",
        notePath,
        "--id",
        "comment-1",
    ], {
        cwd: process.cwd(),
    });

    assert.match(stdout, /Resolved comment comment-1/);

    const updated = await readFile(notePath, "utf8");
    const parsed = parseNoteComments(updated, notePath);
    assert.equal(parsed.comments[0].resolved, true);
    assert.equal(parsed.threads[0].resolved, true);
});

test("comment:resolve can target a stored comment by obsidian side-note URI", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-comment-resolve-uri-script-"));
    const homeDir = path.join(tempDir, "home");
    const vaultRoot = path.join(tempDir, "Public Vault");
    const notePath = path.join(vaultRoot, "Folder", "Note.md");
    const scriptPath = path.resolve(process.cwd(), "bin/sidenote2.mjs");
    const noteFilePath = "Folder/Note.md";
    const original = serializeNoteComments("# Title\n\nBody text.\n", [createComment({
        filePath: noteFilePath,
    })]);

    await mkdir(path.dirname(notePath), { recursive: true });
    await writeObsidianVaultConfig(homeDir, vaultRoot);
    await writeFile(notePath, original, "utf8");

    const { stdout } = await execFile("node", [
        scriptPath,
        "comment:resolve",
        "--uri",
        buildCommentLocationUri("Public Vault", noteFilePath, "comment-1"),
    ], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            HOME: homeDir,
        },
    });

    assert.match(stdout, /Resolved comment comment-1/);

    const updated = await readFile(notePath, "utf8");
    const parsed = parseNoteComments(updated, notePath);
    assert.equal(parsed.comments[0].resolved, true);
});
