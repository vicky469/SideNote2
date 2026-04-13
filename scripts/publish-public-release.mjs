#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { exportPublicReleaseTree } from "./export-public-release.mjs";

function getRepoRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
            env: process.env,
        });

        let stdout = "";
        let stderr = "";

        if (child.stdout) {
            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });
        }

        if (child.stderr) {
            child.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });
        }

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
        });
    });
}

async function getRemoteUrl(repoRoot, remoteName) {
    const result = await runCommand("git", ["remote", "get-url", remoteName], { cwd: repoRoot });
    return result.stdout.trim();
}

async function ensureBranchCheckedOut(repoDir, branchName) {
    try {
        await runCommand("git", ["rev-parse", "--verify", "HEAD"], { cwd: repoDir });
        await runCommand("git", ["checkout", branchName], { cwd: repoDir });
    } catch {
        await runCommand("git", ["checkout", "-b", branchName], { cwd: repoDir });
    }
}

async function clearWorkingTree(repoDir) {
    const entries = await readdir(repoDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === ".git") {
            continue;
        }

        await rm(path.join(repoDir, entry.name), { recursive: true, force: true });
    }
}

async function copyReleaseTreeIntoRepo(exportDir, repoDir) {
    const entries = await readdir(exportDir, { withFileTypes: true });
    for (const entry of entries) {
        await cp(
            path.join(exportDir, entry.name),
            path.join(repoDir, entry.name),
            { force: true, recursive: true },
        );
    }
}

function getManifestVersion(repoRoot) {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));
    return manifest.version;
}

function parseCliArgs(argv) {
    const options = {
        branch: "main",
        push: false,
        remote: "public",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--branch":
                options.branch = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--push":
                options.push = true;
                break;
            case "--remote":
                options.remote = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.branch) {
        throw new Error("Expected a value after --branch.");
    }
    if (!options.remote) {
        throw new Error("Expected a value after --remote.");
    }

    return options;
}

function printUsage() {
    process.stdout.write(
        [
            "Usage:",
            "  node scripts/publish-public-release.mjs",
            "  node scripts/publish-public-release.mjs --push",
            "",
            "Options:",
            "  --remote <name>   git remote to publish to (default: public)",
            "  --branch <name>   git branch to update (default: main)",
            "  --push            push the committed snapshot",
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
    const remoteUrl = await getRemoteUrl(repoRoot, options.remote);
    const exportDir = await mkdtemp(path.join(tmpdir(), "sidenote2-public-export-"));
    const cloneDir = await mkdtemp(path.join(tmpdir(), "sidenote2-public-clone-"));

    try {
        const exportResult = await exportPublicReleaseTree(repoRoot, exportDir);
        await runCommand("git", ["clone", remoteUrl, cloneDir], { cwd: repoRoot });
        await ensureBranchCheckedOut(cloneDir, options.branch);
        await clearWorkingTree(cloneDir);
        await copyReleaseTreeIntoRepo(exportDir, cloneDir);

        await runCommand("git", ["add", "-A"], { cwd: cloneDir });
        const status = await runCommand("git", ["status", "--short"], { cwd: cloneDir });

        if (!status.stdout.trim()) {
            process.stdout.write("Public release repo is already up to date.\n");
            return;
        }

        const version = getManifestVersion(repoRoot);
        const commitMessage = `Publish release ${version}`;
        await runCommand("git", ["commit", "-m", commitMessage], { cwd: cloneDir });
        process.stdout.write(`Committed public release snapshot: ${commitMessage}\n`);

        if (options.push) {
            await runCommand("git", ["push", "-u", "origin", options.branch], { cwd: cloneDir, stdio: "inherit" });
        }

        process.stdout.write(`Prepared ${exportResult.files.length} public release files.\n`);
    } finally {
        await rm(exportDir, { recursive: true, force: true });
        await rm(cloneDir, { recursive: true, force: true });
    }
}

main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
});
