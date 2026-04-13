#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PUBLIC_RELEASE_ALLOWED_FILES = Object.freeze([
    "README.md",
    "LICENSE",
    "manifest.json",
    "styles.css",
    "versions.json",
    "main.js",
    "assets/demo-preview.gif",
    "assets/image.png",
    "assets/logo-readme.svg",
    "assets/logo.svg",
    "assets/share-side-note-icon.svg",
    "skills/sidenote2/SKILL.md",
    "scripts/append-note-comment-entry.mjs",
    "scripts/resolve-note-comment.mjs",
    "scripts/update-note-comment.mjs",
]);

const FORBIDDEN_EXTENSION_PATTERN = /\.(?:ts|tsx|jsx|cts|mts|map)$/i;
const FORBIDDEN_NAME_PATTERN = /(^|\/)(?:\.env[^/]*|\.npmrc|tsconfig(?:\.[^/]*)?\.json|package(?:-lock)?\.json)$/i;

function getRepoRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function ensureParentDirectory(targetPath) {
    await mkdir(path.dirname(targetPath), { recursive: true });
}

export async function listRelativeFilesRecursive(rootDir) {
    const files = [];

    async function walk(currentDir) {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const absolutePath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(absolutePath);
                continue;
            }

            if (entry.isFile()) {
                files.push(path.relative(rootDir, absolutePath).replace(/\\/g, "/"));
            }
        }
    }

    await walk(rootDir);
    return files.sort((left, right) => left.localeCompare(right));
}

export async function collectPublicReleaseEntries(repoRoot) {
    const entries = [];
    for (const relativePath of PUBLIC_RELEASE_ALLOWED_FILES) {
        const sourcePath = path.join(repoRoot, relativePath);
        if (!existsSync(sourcePath)) {
            throw new Error(`Missing required public release source file: ${relativePath}`);
        }

        const sourceStat = await stat(sourcePath);
        if (!sourceStat.isFile()) {
            throw new Error(`Expected a file in the public release allowlist, but found something else: ${relativePath}`);
        }

        entries.push({
            relativePath,
            sourcePath,
        });
    }

    return entries;
}

function assertMainJsIsSafe(mainJsPath) {
    const mainJs = readFileSync(mainJsPath, "utf8");
    if (mainJs.includes("sourceMappingURL") || mainJs.includes("sourcesContent")) {
        throw new Error(`Public release artifact leaked source map markers into ${path.basename(mainJsPath)}`);
    }
}

export async function assertPublicReleaseTree(releaseRoot) {
    const expectedFiles = [...PUBLIC_RELEASE_ALLOWED_FILES].sort((left, right) => left.localeCompare(right));
    const actualFiles = await listRelativeFilesRecursive(releaseRoot);

    if (expectedFiles.length !== actualFiles.length || expectedFiles.some((filePath, index) => filePath !== actualFiles[index])) {
        const unexpectedFiles = actualFiles.filter((filePath) => !PUBLIC_RELEASE_ALLOWED_FILES.includes(filePath));
        const missingFiles = expectedFiles.filter((filePath) => !actualFiles.includes(filePath));
        throw new Error(
            [
                "Public release tree does not match the explicit allowlist.",
                unexpectedFiles.length ? `Unexpected files: ${unexpectedFiles.join(", ")}` : "",
                missingFiles.length ? `Missing files: ${missingFiles.join(", ")}` : "",
            ].filter(Boolean).join(" "),
        );
    }

    for (const relativePath of actualFiles) {
        if (FORBIDDEN_EXTENSION_PATTERN.test(relativePath)) {
            throw new Error(`Public release tree includes a forbidden source-like file: ${relativePath}`);
        }
        if (FORBIDDEN_NAME_PATTERN.test(relativePath)) {
            throw new Error(`Public release tree includes a forbidden config or secret-like file: ${relativePath}`);
        }
        if (
            relativePath.startsWith("src/")
            || relativePath.startsWith("tests/")
            || relativePath.startsWith("docs/")
        ) {
            throw new Error(`Public release tree includes an internal source directory: ${relativePath}`);
        }
    }

    const mainJsPath = path.join(releaseRoot, "main.js");
    if (!existsSync(mainJsPath)) {
        throw new Error("Public release tree is missing main.js");
    }
    assertMainJsIsSafe(mainJsPath);
}

export async function exportPublicReleaseTree(repoRoot, outDir) {
    const entries = await collectPublicReleaseEntries(repoRoot);
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    for (const entry of entries) {
        const destinationPath = path.join(outDir, entry.relativePath);
        await ensureParentDirectory(destinationPath);
        await copyFile(entry.sourcePath, destinationPath);
    }

    await assertPublicReleaseTree(outDir);

    return {
        outDir,
        files: entries.map((entry) => entry.relativePath),
    };
}

function parseCliArgs(argv) {
    const options = {
        checkOnly: false,
        outDir: ".public-release",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--check":
                options.checkOnly = true;
                break;
            case "--out-dir":
                options.outDir = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.checkOnly && !options.outDir) {
        throw new Error("Expected a value after --out-dir.");
    }

    return options;
}

function printUsage() {
    process.stdout.write(
        [
            "Usage:",
            "  node scripts/export-public-release.mjs --check",
            "  node scripts/export-public-release.mjs --out-dir .public-release",
            "",
            "Options:",
            "  --check            validate the explicit public release export in a temporary directory",
            "  --out-dir <path>   write the public release snapshot to a directory",
        ].join("\n") + "\n",
    );
}

async function main(argv) {
    const options = parseCliArgs(argv);
    if (!options) {
        printUsage();
        return;
    }

    const repoRoot = getRepoRoot();
    if (options.checkOnly) {
        const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-public-release-"));
        try {
            const result = await exportPublicReleaseTree(repoRoot, tempDir);
            process.stdout.write(`Public release tree check passed (${result.files.length} files).\n`);
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
        return;
    }

    const outDir = path.resolve(process.cwd(), options.outDir);
    const result = await exportPublicReleaseTree(repoRoot, outDir);
    process.stdout.write(`Exported public release tree to ${outDir}\n`);
}

const isDirectRun = process.argv[1]
    ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
    : false;

if (isDirectRun) {
    main(process.argv.slice(2)).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    });
}
