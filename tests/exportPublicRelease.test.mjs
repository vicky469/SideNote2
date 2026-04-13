import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
    PUBLIC_RELEASE_ALLOWED_FILES,
    assertPublicReleaseTree,
    collectPublicReleaseEntries,
    exportPublicReleaseTree,
    listRelativeFilesRecursive,
} from "../scripts/export-public-release.mjs";

async function writeFixtureFile(rootDir, relativePath, content = "") {
    const targetPath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
}

async function createPublicReleaseSourceFixture(rootDir, options = {}) {
    const omit = new Set(options.omit ?? []);

    for (const relativePath of PUBLIC_RELEASE_ALLOWED_FILES) {
        if (omit.has(relativePath)) {
            continue;
        }

        const content = relativePath === "main.js"
            ? "console.log('safe build');\n"
            : `${relativePath}\n`;
        await writeFixtureFile(rootDir, relativePath, content);
    }
}

test("exportPublicReleaseTree copies only the explicit public allowlist", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "sidenote2-public-source-"));
    const outDir = await mkdtemp(path.join(tmpdir(), "sidenote2-public-export-"));

    try {
        await createPublicReleaseSourceFixture(repoRoot);
        await writeFixtureFile(repoRoot, "src/main.ts", "private source\n");
        await writeFixtureFile(repoRoot, "tests/private.test.ts", "private tests\n");
        await writeFixtureFile(repoRoot, "skills/dev/internal/SKILL.md", "internal skill\n");
        await writeFixtureFile(repoRoot, "scripts/generate-large-graph-fixture.mjs", "internal helper\n");

        await exportPublicReleaseTree(repoRoot, outDir);
        const actualFiles = await listRelativeFilesRecursive(outDir);

        assert.deepEqual(
            actualFiles,
            [...PUBLIC_RELEASE_ALLOWED_FILES].sort((left, right) => left.localeCompare(right)),
        );
        assert.equal(actualFiles.includes("src/main.ts"), false);
        assert.equal(actualFiles.includes("skills/dev/internal/SKILL.md"), false);
        assert.equal(actualFiles.includes("scripts/generate-large-graph-fixture.mjs"), false);
    } finally {
        await rm(repoRoot, { recursive: true, force: true });
        await rm(outDir, { recursive: true, force: true });
    }
});

test("collectPublicReleaseEntries rejects a missing required public artifact", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "sidenote2-public-source-"));

    try {
        await createPublicReleaseSourceFixture(repoRoot, {
            omit: ["main.js"],
        });

        await assert.rejects(
            collectPublicReleaseEntries(repoRoot),
            /Missing required public release source file: main\.js/,
        );
    } finally {
        await rm(repoRoot, { recursive: true, force: true });
    }
});

test("assertPublicReleaseTree rejects leaked source-like files", async () => {
    const releaseRoot = await mkdtemp(path.join(tmpdir(), "sidenote2-public-tree-"));

    try {
        await createPublicReleaseSourceFixture(releaseRoot);
        await writeFixtureFile(releaseRoot, "src/main.ts", "leak\n");

        await assert.rejects(
            assertPublicReleaseTree(releaseRoot),
            /Public release tree does not match the explicit allowlist/,
        );
    } finally {
        await rm(releaseRoot, { recursive: true, force: true });
    }
});
