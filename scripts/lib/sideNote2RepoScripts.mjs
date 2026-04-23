import * as esbuild from "esbuild";
import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getRepoRoot(metaUrl) {
    return path.resolve(path.dirname(fileURLToPath(metaUrl)), "../..");
}

function parseNonNegativeIntegerOption(rawValue, flagName) {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Expected ${flagName} to be a non-negative integer.`);
    }

    return parsed;
}

function printCreateNoteCommentThreadUsage(stream = process.stderr) {
    stream.write(
        [
            "Usage:",
            "  node scripts/create-note-comment-thread.mjs --file <note.md> --page (--comment <text> | --comment-file <path> | --stdin) [--settle-ms <milliseconds>]",
            "  node scripts/create-note-comment-thread.mjs --file <note.md> --selected-text <text> --start-line <number> --start-char <number> --end-line <number> --end-char <number> (--comment <text> | --comment-file <path> | --stdin) [--settle-ms <milliseconds>]",
        ].join("\n") + "\n",
    );
}

function printAppendNoteCommentEntryUsage(stream = process.stderr) {
    stream.write(
        [
            "Usage:",
            "  node scripts/append-note-comment-entry.mjs (--file <note.md> --id <comment-id> | --uri <obsidian://side-note2-comment?...>) (--comment <text> | --comment-file <path> | --stdin) [--settle-ms <milliseconds>]",
        ].join("\n") + "\n",
    );
}

function printUpdateNoteCommentUsage(stream = process.stderr) {
    stream.write(
        [
            "Usage:",
            "  node scripts/update-note-comment.mjs (--file <note.md> --id <comment-id> | --uri <obsidian://side-note2-comment?...>) (--comment <text> | --comment-file <path> | --stdin) [--settle-ms <milliseconds>]",
        ].join("\n") + "\n",
    );
}

function printResolveNoteCommentUsage(stream = process.stderr) {
    stream.write(
        [
            "Usage:",
            "  node scripts/resolve-note-comment.mjs (--file <note.md> --id <comment-id> | --uri <obsidian://side-note2-comment?...>) [--settle-ms <milliseconds>]",
        ].join("\n") + "\n",
    );
}

function printInstallBundledSkillUsage(stream = process.stderr) {
    stream.write(
        [
            "Usage:",
            "  node scripts/install-bundled-skill.mjs [--name <skill-name>]... [--dest <skills-root>]",
            "",
            "Defaults:",
            "  installs all bundled skills when --name is omitted",
            "  --dest defaults to $CODEX_HOME/skills or ~/.codex/skills",
        ].join("\n") + "\n",
    );
}

function parseCommentTargetArgs(argv, options) {
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--file":
                options.file = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--id":
                options.id = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--uri":
                options.uri = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--settle-ms":
                options.settleMs = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--settle-ms");
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                return arg;
        }
    }

    return undefined;
}

function parseCreateNoteCommentThreadArgs(argv) {
    const options = {
        file: "",
        page: false,
        selectedText: "",
        startLine: null,
        startChar: null,
        endLine: null,
        endChar: null,
        comment: null,
        commentFile: "",
        stdin: false,
        settleMs: 0,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--file":
                options.file = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--page":
                options.page = true;
                break;
            case "--selected-text":
                options.selectedText = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--start-line":
                options.startLine = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--start-line");
                index += 1;
                break;
            case "--start-char":
                options.startChar = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--start-char");
                index += 1;
                break;
            case "--end-line":
                options.endLine = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--end-line");
                index += 1;
                break;
            case "--end-char":
                options.endChar = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--end-char");
                index += 1;
                break;
            case "--comment":
                options.comment = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--comment-file":
                options.commentFile = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--stdin":
                options.stdin = true;
                break;
            case "--settle-ms":
                options.settleMs = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--settle-ms");
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    const contentSources = [options.comment !== null, Boolean(options.commentFile), options.stdin].filter(Boolean).length;
    if (!options.file || contentSources !== 1) {
        throw new Error("Expected --file plus exactly one comment source.");
    }

    const hasSelectionTarget = options.selectedText.length > 0
        || options.startLine !== null
        || options.startChar !== null
        || options.endLine !== null
        || options.endChar !== null;
    if (options.page && hasSelectionTarget) {
        throw new Error("Expected either --page or a selection target, not both.");
    }

    if (!options.page) {
        if (
            !options.selectedText
            || options.startLine === null
            || options.startChar === null
            || options.endLine === null
            || options.endChar === null
        ) {
            throw new Error(
                "Expected --page, or --selected-text with --start-line/--start-char/--end-line/--end-char.",
            );
        }

        if (
            options.endLine < options.startLine
            || (options.endLine === options.startLine && options.endChar < options.startChar)
        ) {
            throw new Error("Expected the end position to be at or after the start position.");
        }
    }

    return options;
}

function parseAppendOrUpdateArgs(argv) {
    const options = {
        file: "",
        id: "",
        uri: "",
        comment: null,
        commentFile: "",
        stdin: false,
        settleMs: 0,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--file":
                options.file = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--id":
                options.id = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--uri":
                options.uri = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--comment":
                options.comment = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--comment-file":
                options.commentFile = argv[index + 1] ?? "";
                index += 1;
                break;
            case "--stdin":
                options.stdin = true;
                break;
            case "--settle-ms":
                options.settleMs = parseNonNegativeIntegerOption(argv[index + 1] ?? "", "--settle-ms");
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    const contentSources = [options.comment !== null, Boolean(options.commentFile), options.stdin].filter(Boolean).length;
    const hasFileOrIdTarget = Boolean(options.file || options.id);
    const hasFileAndIdTarget = Boolean(options.file && options.id);
    const hasUriTarget = Boolean(options.uri);
    if (contentSources !== 1 || (hasFileOrIdTarget ? 1 : 0) + (hasUriTarget ? 1 : 0) !== 1 || (hasFileOrIdTarget && !hasFileAndIdTarget)) {
        throw new Error("Expected exactly one target form: either --file with --id, or --uri, plus exactly one comment source.");
    }

    return options;
}

function parseResolveArgs(argv) {
    const options = {
        file: "",
        id: "",
        uri: "",
        settleMs: 0,
    };

    const result = parseCommentTargetArgs(argv, options);
    if (result === null) {
        return null;
    }
    if (typeof result === "string") {
        throw new Error(`Unknown argument: ${result}`);
    }

    const hasFileOrIdTarget = Boolean(options.file || options.id);
    const hasFileAndIdTarget = Boolean(options.file && options.id);
    const hasUriTarget = Boolean(options.uri);
    if ((hasFileOrIdTarget ? 1 : 0) + (hasUriTarget ? 1 : 0) !== 1 || (hasFileOrIdTarget && !hasFileAndIdTarget)) {
        throw new Error("Expected exactly one target form: either --file with --id, or --uri.");
    }

    return options;
}

function getDefaultSkillsRoot() {
    const codexHome = process.env.CODEX_HOME?.trim();
    return codexHome
        ? path.join(codexHome, "skills")
        : path.join(homedir(), ".codex", "skills");
}

function parseInstallBundledSkillArgs(argv) {
    const options = {
        destRoot: getDefaultSkillsRoot(),
        skillNames: [],
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case "--name": {
                const skillName = argv[index + 1] ?? "";
                if (!skillName) {
                    throw new Error("Expected a skill name after --name.");
                }
                options.skillNames.push(skillName);
                index += 1;
                break;
            }
            case "--dest":
                options.destRoot = path.resolve(process.cwd(), argv[index + 1] ?? "");
                index += 1;
                break;
            case "--help":
            case "-h":
                return null;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function copyDirectoryRecursive(sourceDir, destinationDir) {
    await mkdir(destinationDir, { recursive: true });
    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);
        if (entry.isDirectory()) {
            await copyDirectoryRecursive(sourcePath, destinationPath);
            continue;
        }

        if (entry.isFile()) {
            await copyFile(sourcePath, destinationPath);
            continue;
        }

        throw new Error(`Unsupported skill entry type: ${sourcePath}`);
    }
}

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

export function createContentFingerprint(content) {
    return `${Buffer.byteLength(content, "utf8")}:${createHash("sha256").update(content).digest("hex")}`;
}

async function writeFileAtomically(targetPath, content) {
    const tempPath = path.join(
        path.dirname(targetPath),
        `.${path.basename(targetPath)}.sidenote2-${process.pid}-${randomUUID()}.tmp`,
    );
    await writeFile(tempPath, content, "utf8");
    try {
        await rename(tempPath, targetPath);
    } catch (error) {
        await rm(tempPath, { force: true });
        throw error;
    }
}

export async function writeObservedNoteSafely(notePath, expectedFingerprint, nextContent, options = {}) {
    const settleMs = options.settleMs ?? 0;
    if (settleMs > 0) {
        await sleep(settleMs);
    }

    let currentContent;
    try {
        currentContent = await readFile(notePath, "utf8");
    } catch (error) {
        return {
            kind: "changed",
            reason: error instanceof Error ? error.message : String(error),
        };
    }

    if (createContentFingerprint(currentContent) !== expectedFingerprint) {
        return {
            kind: "changed",
            reason: "content changed after the script read it",
        };
    }

    await writeFileAtomically(notePath, nextContent);
    return { kind: "written" };
}

async function loadCommentBody(options) {
    if (options.comment !== null) {
        return options.comment;
    }

    if (options.commentFile) {
        return readFile(path.resolve(process.cwd(), options.commentFile), "utf8");
    }

    return readStdin();
}

function getPageCommentLabelForPath(filePath) {
    return path.basename(filePath).replace(/\.[^.]+$/i, "") || filePath;
}

function hashCommentSelection(text) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

const COMMENT_LOCATION_PROTOCOL = "side-note2-comment";

function parseCommentProtocolUri(uri) {
    try {
        const parsed = new URL(uri);
        if (parsed.protocol !== "obsidian:" || parsed.hostname !== COMMENT_LOCATION_PROTOCOL) {
            return null;
        }

        const vaultName = parsed.searchParams.get("vault");
        const filePath = parsed.searchParams.get("file");
        const commentId = parsed.searchParams.get("commentId");
        if (!(vaultName && filePath && commentId)) {
            return null;
        }

        return {
            vaultName,
            filePath,
            commentId,
        };
    } catch {
        return null;
    }
}

function getObsidianConfigPath() {
    const explicitConfigPath = process.env.OBSIDIAN_CONFIG_PATH?.trim();
    return explicitConfigPath
        ? path.resolve(process.cwd(), explicitConfigPath)
        : path.join(homedir(), ".config", "obsidian", "obsidian.json");
}

async function resolveVaultRootByName(vaultName) {
    const configPath = getObsidianConfigPath();
    let config;
    try {
        config = JSON.parse(await readFile(configPath, "utf8"));
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not read Obsidian vault config at ${configPath}: ${reason}`);
    }

    const configuredVaults = config?.vaults;
    if (!configuredVaults || typeof configuredVaults !== "object") {
        throw new Error(`Obsidian vault config at ${configPath} does not contain a valid vault list.`);
    }

    const matchingVaultRoots = [];
    for (const value of Object.values(configuredVaults)) {
        if (!value || typeof value !== "object") {
            continue;
        }

        const vaultPath = typeof value.path === "string" ? value.path : "";
        if (!vaultPath) {
            continue;
        }

        const resolvedVaultPath = path.resolve(vaultPath);
        if (path.basename(resolvedVaultPath) === vaultName) {
            matchingVaultRoots.push(resolvedVaultPath);
        }
    }

    if (matchingVaultRoots.length === 0) {
        throw new Error(`Could not resolve Obsidian vault "${vaultName}" from ${configPath}.`);
    }

    if (matchingVaultRoots.length > 1) {
        throw new Error(`Found multiple Obsidian vaults named "${vaultName}" in ${configPath}.`);
    }

    return matchingVaultRoots[0];
}

function resolveVaultRelativeNotePath(vaultRoot, filePath) {
    const resolvedNotePath = path.resolve(vaultRoot, filePath);
    const relativePath = path.relative(vaultRoot, resolvedNotePath);
    if (
        relativePath.startsWith("..")
        || path.isAbsolute(relativePath)
        || relativePath === ""
        || relativePath === "."
    ) {
        throw new Error(`Comment URI file path escapes the resolved vault root: ${filePath}`);
    }

    return resolvedNotePath;
}

async function resolveCommentWriteTarget(options) {
    if (options.uri) {
        const uriTarget = parseCommentProtocolUri(options.uri);
        if (!uriTarget) {
            throw new Error("Expected --uri to be an obsidian://side-note2-comment link with vault, file, and commentId.");
        }

        const vaultRoot = await resolveVaultRootByName(uriTarget.vaultName);
        return {
            notePath: resolveVaultRelativeNotePath(vaultRoot, uriTarget.filePath),
            commentId: uriTarget.commentId,
        };
    }

    return {
        notePath: path.resolve(process.cwd(), options.file),
        commentId: options.id,
    };
}

async function getBundledSkills() {
    const repoRoot = getRepoRoot(import.meta.url);
    const skillsRoot = path.join(repoRoot, "skills");
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    const skillNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));

    if (skillNames.length === 0) {
        throw new Error(`No bundled skills found in ${skillsRoot}`);
    }

    const skillDirectories = new Map();
    for (const skillName of skillNames) {
        const sourceDir = path.join(skillsRoot, skillName);
        const skillFile = path.join(sourceDir, "SKILL.md");
        if (!(await pathExists(skillFile))) {
            continue;
        }
        skillDirectories.set(skillName, sourceDir);
    }

    if (skillDirectories.size === 0) {
        throw new Error(`No bundled skills with SKILL.md found in ${skillsRoot}`);
    }

    return { skillDirectories };
}

async function loadStorageModule() {
    const repoRoot = getRepoRoot(import.meta.url);
    const entryPoint = path.resolve(repoRoot, "src/core/storage/noteCommentStorage.ts");
    const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        format: "esm",
        platform: "node",
        target: ["node18"],
        write: false,
        logLevel: "silent",
    });

    const output = result.outputFiles?.[0]?.text;
    if (!output) {
        throw new Error("Failed to bundle noteCommentStorage.ts");
    }

    const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
    return import(moduleUrl);
}

function getManagedSectionErrorMessage(storageModule, noteContent, notePath) {
    const problem = typeof storageModule.getManagedSectionProblem === "function"
        ? storageModule.getManagedSectionProblem(noteContent)
        : null;

    if (problem === "multiple") {
        return `Found multiple SideNote2 comments blocks in ${notePath}. Collapse them to exactly one managed block before writing.\n`;
    }

    return `Found a SideNote2 comments block in ${notePath}, but it is not a supported threaded entries[] payload.\n`;
}

export async function runCreateNoteCommentThread(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
    let options;
    try {
        options = parseCreateNoteCommentThreadArgs(argv);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        printCreateNoteCommentThreadUsage(io.stderr);
        return 1;
    }

    if (options === null) {
        printCreateNoteCommentThreadUsage(io.stdout);
        return 0;
    }

    const notePath = path.resolve(process.cwd(), options.file);
    const nextCommentBody = await loadCommentBody(options);
    const noteContent = await readFile(notePath, "utf8");
    const storageModule = await loadStorageModule();
    const managedSectionKind = storageModule.getManagedSectionKind(noteContent);
    if (managedSectionKind === "unsupported") {
        io.stderr.write(getManagedSectionErrorMessage(storageModule, noteContent, notePath));
        return 1;
    }

    const parsed = storageModule.parseNoteComments(noteContent, notePath);
    const timestamp = Date.now();
    const threadId = randomUUID();
    const selectedText = options.page
        ? getPageCommentLabelForPath(notePath)
        : options.selectedText;
    const nextThread = {
        id: threadId,
        filePath: notePath,
        startLine: options.page ? 0 : options.startLine,
        startChar: options.page ? 0 : options.startChar,
        endLine: options.page ? 0 : options.endLine,
        endChar: options.page ? 0 : options.endChar,
        selectedText,
        selectedTextHash: hashCommentSelection(selectedText),
        anchorKind: options.page ? "page" : "selection",
        orphaned: false,
        resolved: false,
        entries: [{
            id: threadId,
            body: nextCommentBody,
            timestamp,
        }],
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    const updated = storageModule.serializeNoteCommentThreads(noteContent, [...parsed.threads, nextThread]);

    const writeResult = await writeObservedNoteSafely(notePath, createContentFingerprint(noteContent), updated, {
        settleMs: options.settleMs,
    });
    if (writeResult.kind === "changed") {
        io.stderr.write(
            `Skipped creating a comment in ${notePath} because ${writeResult.reason}. `
            + "Rerun after Obsidian Sync or other local edits settle.\n",
        );
        return 1;
    }

    const anchorLabel = options.page ? "page note" : "anchored note";
    io.stdout.write(`Created ${anchorLabel} thread ${threadId} in ${notePath}\n`);
    return 0;
}

export async function runAppendNoteCommentEntry(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
    let options;
    try {
        options = parseAppendOrUpdateArgs(argv);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        printAppendNoteCommentEntryUsage(io.stderr);
        return 1;
    }

    if (options === null) {
        printAppendNoteCommentEntryUsage(io.stdout);
        return 0;
    }

    let writeTarget;
    try {
        writeTarget = await resolveCommentWriteTarget(options);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }

    const notePath = writeTarget.notePath;
    const commentId = writeTarget.commentId;
    const nextCommentBody = await loadCommentBody(options);
    const noteContent = await readFile(notePath, "utf8");
    const storageModule = await loadStorageModule();
    const updated = storageModule.appendNoteCommentEntryById(noteContent, notePath, commentId, {
        id: randomUUID(),
        body: nextCommentBody,
        timestamp: Date.now(),
    });

    if (typeof updated !== "string") {
        const managedSectionKind = storageModule.getManagedSectionKind(noteContent);
        if (managedSectionKind === "unsupported") {
            io.stderr.write(getManagedSectionErrorMessage(storageModule, noteContent, notePath));
            return 1;
        }

        if (managedSectionKind === "none") {
            io.stderr.write(`No SideNote2 comments block found in ${notePath}\n`);
            return 1;
        }

        io.stderr.write(`Comment id not found: ${commentId}\n`);
        return 1;
    }

    const writeResult = await writeObservedNoteSafely(notePath, createContentFingerprint(noteContent), updated, {
        settleMs: options.settleMs,
    });
    if (writeResult.kind === "changed") {
        io.stderr.write(
            `Skipped appending to ${notePath} because ${writeResult.reason}. `
            + "Rerun after Obsidian Sync or other local edits settle.\n",
        );
        return 1;
    }

    io.stdout.write(`Appended a new entry to comment ${commentId} in ${notePath}\n`);
    return 0;
}

export async function runUpdateNoteComment(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
    let options;
    try {
        options = parseAppendOrUpdateArgs(argv);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        printUpdateNoteCommentUsage(io.stderr);
        return 1;
    }

    if (options === null) {
        printUpdateNoteCommentUsage(io.stdout);
        return 0;
    }

    let writeTarget;
    try {
        writeTarget = await resolveCommentWriteTarget(options);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }

    const notePath = writeTarget.notePath;
    const commentId = writeTarget.commentId;
    const nextCommentBody = await loadCommentBody(options);
    const noteContent = await readFile(notePath, "utf8");
    const storageModule = await loadStorageModule();
    const updated = storageModule.replaceNoteCommentBodyById(noteContent, notePath, commentId, nextCommentBody);

    if (typeof updated !== "string") {
        if (storageModule.getManagedSectionKind(noteContent) === "unsupported") {
            io.stderr.write(getManagedSectionErrorMessage(storageModule, noteContent, notePath));
            return 1;
        }

        io.stderr.write(`Comment id not found: ${commentId}\n`);
        return 1;
    }

    const writeResult = await writeObservedNoteSafely(notePath, createContentFingerprint(noteContent), updated, {
        settleMs: options.settleMs,
    });
    if (writeResult.kind === "changed") {
        io.stderr.write(
            `Skipped updating ${notePath} because ${writeResult.reason}. `
            + "Rerun after Obsidian Sync or other local edits settle.\n",
        );
        return 1;
    }

    io.stdout.write(`Updated comment ${commentId} in ${notePath}\n`);
    return 0;
}

export async function runResolveNoteComment(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
    let options;
    try {
        options = parseResolveArgs(argv);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        printResolveNoteCommentUsage(io.stderr);
        return 1;
    }

    if (options === null) {
        printResolveNoteCommentUsage(io.stdout);
        return 0;
    }

    let writeTarget;
    try {
        writeTarget = await resolveCommentWriteTarget(options);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }

    const notePath = writeTarget.notePath;
    const commentId = writeTarget.commentId;
    const noteContent = await readFile(notePath, "utf8");
    const storageModule = await loadStorageModule();
    const updated = storageModule.resolveNoteCommentById(noteContent, notePath, commentId);

    if (typeof updated !== "string") {
        const managedSectionKind = storageModule.getManagedSectionKind(noteContent);
        if (managedSectionKind === "unsupported") {
            io.stderr.write(getManagedSectionErrorMessage(storageModule, noteContent, notePath));
            return 1;
        }

        if (managedSectionKind === "none") {
            io.stderr.write(`No SideNote2 comments block found in ${notePath}\n`);
            return 1;
        }

        io.stderr.write(`Comment id not found: ${commentId}\n`);
        return 1;
    }

    const writeResult = await writeObservedNoteSafely(notePath, createContentFingerprint(noteContent), updated, {
        settleMs: options.settleMs,
    });
    if (writeResult.kind === "changed") {
        io.stderr.write(
            `Skipped resolving ${notePath} because ${writeResult.reason}. `
            + "Rerun after Obsidian Sync or other local edits settle.\n",
        );
        return 1;
    }

    io.stdout.write(`Resolved comment ${commentId} in ${notePath}\n`);
    return 0;
}

export async function runInstallBundledSkill(argv, io = { stdout: process.stdout, stderr: process.stderr }) {
    let options;
    try {
        options = parseInstallBundledSkillArgs(argv);
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        printInstallBundledSkillUsage(io.stderr);
        return 1;
    }

    if (options === null) {
        printInstallBundledSkillUsage(io.stdout);
        return 0;
    }

    const { skillDirectories } = await getBundledSkills();
    const requestedSkillNames = options.skillNames.length > 0
        ? [...new Set(options.skillNames)]
        : [...skillDirectories.keys()];

    const destinationRoot = options.destRoot;
    await mkdir(destinationRoot, { recursive: true });
    for (const skillName of requestedSkillNames) {
        const sourceDir = skillDirectories.get(skillName);
        if (!sourceDir) {
            throw new Error(`Bundled skill not found: ${skillName}`);
        }

        const destinationDir = path.join(destinationRoot, skillName);
        await rm(destinationDir, { recursive: true, force: true });
        await copyDirectoryRecursive(sourceDir, destinationDir);
        io.stdout.write(`Installed skill ${skillName} to ${destinationDir}\n`);
    }
    io.stdout.write("Restart Codex to pick up new skills.\n");
    return 0;
}

export async function runScriptMain(run, argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
    try {
        const exitCode = await run(argv, io);
        if (exitCode !== 0) {
            process.exitCode = exitCode;
        }
    } catch (error) {
        io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
