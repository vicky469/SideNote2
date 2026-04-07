import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

async function run(command, args, cwd) {
    return execFile(command, args, { cwd });
}

test("prepare-review-bundle script exports a read-only snapshot and review metadata", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-review-bundle-"));
    const repoDir = path.join(tempDir, "repo");
    const bundleDir = path.join(tempDir, "bundle");
    const scriptPath = path.resolve(process.cwd(), "scripts/prepare-review-bundle.sh");

    await mkdir(repoDir, { recursive: true });
    await run("git", ["init"], repoDir);
    await run("git", ["config", "user.name", "Test User"], repoDir);
    await run("git", ["config", "user.email", "test@example.com"], repoDir);

    await writeFile(path.join(repoDir, ".gitignore"), "*.log\nignored-dir/\n", "utf8");
    await writeFile(path.join(repoDir, "tracked.md"), "# Title\n", "utf8");
    await run("git", ["add", ".gitignore", "tracked.md"], repoDir);
    await run("git", ["commit", "-m", "Initial commit"], repoDir);

    await writeFile(path.join(repoDir, "tracked.md"), "# Title\n\nUpdated body.\n", "utf8");
    await writeFile(path.join(repoDir, "new-note.md"), "Untracked note\n", "utf8");
    await writeFile(path.join(repoDir, "skip.log"), "ignored\n", "utf8");
    await mkdir(path.join(repoDir, "ignored-dir"), { recursive: true });
    await writeFile(path.join(repoDir, "ignored-dir", "ignored.md"), "ignored\n", "utf8");

    const { stdout } = await run("bash", [
        scriptPath,
        "--repo",
        repoDir,
        "--output",
        bundleDir,
    ], process.cwd());

    assert.match(stdout, /Prepared review bundle:/);

    const statusText = await readFile(path.join(bundleDir, "status.txt"), "utf8");
    assert.match(statusText, /tracked\.md/);
    assert.match(statusText, /\?\? new-note\.md/);

    const reviewPatch = await readFile(path.join(bundleDir, "review.patch"), "utf8");
    assert.match(reviewPatch, /Updated body\./);

    const trackedSnapshot = await readFile(path.join(bundleDir, "snapshot", "tracked.md"), "utf8");
    const untrackedSnapshot = await readFile(path.join(bundleDir, "snapshot", "new-note.md"), "utf8");
    assert.equal(trackedSnapshot, "# Title\n\nUpdated body.\n");
    assert.equal(untrackedSnapshot, "Untracked note\n");

    await assert.rejects(
        access(path.join(bundleDir, "snapshot", ".git"), fsConstants.F_OK),
        /ENOENT/,
    );
    await assert.rejects(
        access(path.join(bundleDir, "snapshot", "skip.log"), fsConstants.F_OK),
        /ENOENT/,
    );
    await assert.rejects(
        access(path.join(bundleDir, "snapshot", "ignored-dir", "ignored.md"), fsConstants.F_OK),
        /ENOENT/,
    );

    const snapshotStat = await stat(path.join(bundleDir, "snapshot", "tracked.md"));
    assert.equal(Boolean(snapshotStat.mode & 0o200), false);
});
