import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { commentToThread, type Comment } from "../src/commentManager";
import { parseNoteComments, serializeNoteCommentThreads } from "../src/core/storage/noteCommentStorage";

const execFile = promisify(execFileCallback);

function createComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: overrides.id ?? "comment-1",
        filePath: overrides.filePath ?? "note.md",
        startLine: overrides.startLine ?? 0,
        startChar: overrides.startChar ?? 0,
        endLine: overrides.endLine ?? 0,
        endChar: overrides.endChar ?? 0,
        selectedText: overrides.selectedText ?? "note",
        selectedTextHash: overrides.selectedTextHash ?? "hash:note",
        comment: overrides.comment ?? "Comment body",
        timestamp: overrides.timestamp ?? 1710000000000,
        anchorKind: overrides.anchorKind ?? "page",
        orphaned: overrides.orphaned ?? false,
        resolved: overrides.resolved ?? false,
    };
}

test("generate-large-graph-fixture preserves existing SideNote2 threads in fixture notes", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-graph-fixture-"));
    const scriptPath = path.resolve(process.cwd(), "scripts/generate-large-graph-fixture.mjs");
    const noteRelativePath = "SideNote2 Graph Fixtures/graph-1000/size-30/chain/g30-chain-c01-n01.md";
    const notePath = path.join(tempDir, noteRelativePath);

    await mkdir(path.dirname(notePath), { recursive: true });

    const syntheticThread = commentToThread(createComment({
        id: "lg-g30-chain-c01-n01",
        filePath: noteRelativePath,
        selectedText: "g30-chain-c01-n01",
        selectedTextHash: "hash:g30-chain-c01-n01",
        comment: "Old synthetic body",
        resolved: true,
        timestamp: 1710000000000,
    }));
    syntheticThread.entries.push({
        id: "reply-1",
        body: "Keep this reply",
        timestamp: 1710000001000,
    });
    syntheticThread.updatedAt = 1710000001000;

    const manualThread = commentToThread(createComment({
        id: "manual-1",
        filePath: noteRelativePath,
        selectedText: "g30-chain-c01-n01",
        selectedTextHash: "hash:manual",
        comment: "Manual extra note",
        timestamp: 1710000002000,
    }));

    await writeFile(
        notePath,
        serializeNoteCommentThreads("Old fixture body\n", [syntheticThread, manualThread]),
        "utf8",
    );

    await execFile("node", [
        scriptPath,
        "--vault-root",
        tempDir,
        "--limit",
        "1",
    ], {
        cwd: process.cwd(),
    });

    const updated = await readFile(notePath, "utf8");
    const parsed = parseNoteComments(updated, noteRelativePath);

    assert.match(parsed.mainContent, /^# g30-chain-c01-n01/m);
    assert.equal(parsed.threads.length, 2);

    const updatedSyntheticThread = parsed.threads.find((thread) => thread.id === "lg-g30-chain-c01-n01");
    assert.ok(updatedSyntheticThread);
    assert.equal(updatedSyntheticThread.resolved, true);
    assert.equal(updatedSyntheticThread.entries.length, 2);
    assert.match(updatedSyntheticThread.entries[0].body, /Synthetic graph fixture for chain-size-30-component-01\./);
    assert.match(updatedSyntheticThread.entries[0].body, /\[\[g30-chain-c01-n02\]\]/);
    assert.equal(updatedSyntheticThread.entries[1].body, "Keep this reply");

    const preservedManualThread = parsed.threads.find((thread) => thread.id === "manual-1");
    assert.ok(preservedManualThread);
    assert.equal(preservedManualThread.entries[0].body, "Manual extra note");
});
