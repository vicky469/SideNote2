import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildVaultAgentsFileContent } from "../src/control/vaultAgentsFileController";

const execFile = promisify(execFileCallback);

test("uninstall-agent-support removes the SideNote2-managed AGENTS block and bundled skills", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-agent-uninstall-"));
    const vaultRoot = path.join(tempDir, "vault");
    const skillsRoot = path.join(tempDir, "skills");
    const cliPath = path.resolve(process.cwd(), "bin/sidenote2.mjs");
    const agentsPath = path.join(vaultRoot, "AGENTS.md");

    await mkdir(vaultRoot, { recursive: true });
    await mkdir(path.join(skillsRoot, "sidenote2"), { recursive: true });
    await mkdir(path.join(skillsRoot, "canvas-design"), { recursive: true });
    await mkdir(path.join(skillsRoot, "other-skill"), { recursive: true });

    await writeFile(path.join(skillsRoot, "sidenote2", "SKILL.md"), "skill one", "utf8");
    await writeFile(path.join(skillsRoot, "canvas-design", "SKILL.md"), "skill two", "utf8");
    await writeFile(path.join(skillsRoot, "other-skill", "SKILL.md"), "keep me", "utf8");

    const managedAgentsContent = buildVaultAgentsFileContent({
        vaultName: "public",
        vaultRootPath: vaultRoot,
        pluginVersion: "2.0.2",
    });
    await writeFile(agentsPath, `# User Rules\n\nKeep answers brief.\n\n${managedAgentsContent}`, "utf8");

    const { stdout } = await execFile("node", [
        cliPath,
        "uninstall-agent-support",
        "--vault-root",
        vaultRoot,
        "--skills-root",
        skillsRoot,
    ], {
        cwd: process.cwd(),
    });

    assert.match(stdout, /Removed the SideNote2-managed AGENTS block/);
    assert.match(stdout, /Removed skill sidenote2/);
    assert.match(stdout, /Removed skill canvas-design/);
    assert.match(stdout, /Restart Codex to drop any cached skills\./);

    const nextAgentsContent = await readFile(agentsPath, "utf8");
    assert.match(nextAgentsContent, /# User Rules/);
    assert.match(nextAgentsContent, /Keep answers brief\./);
    assert.doesNotMatch(nextAgentsContent, /SideNote2 Vault Agent Routing/);

    await assert.rejects(access(path.join(skillsRoot, "sidenote2")));
    await assert.rejects(access(path.join(skillsRoot, "canvas-design")));
    await access(path.join(skillsRoot, "other-skill", "SKILL.md"));
});

test("uninstall-agent-support deletes AGENTS.md when only SideNote2-managed content exists", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "sidenote2-agent-uninstall-managed-only-"));
    const vaultRoot = path.join(tempDir, "vault");
    const skillsRoot = path.join(tempDir, "skills");
    const cliPath = path.resolve(process.cwd(), "bin/sidenote2.mjs");
    const agentsPath = path.join(vaultRoot, "AGENTS.md");

    await mkdir(vaultRoot, { recursive: true });
    await mkdir(skillsRoot, { recursive: true });

    await writeFile(agentsPath, buildVaultAgentsFileContent({
        vaultName: "public",
        vaultRootPath: vaultRoot,
        pluginVersion: "2.0.2",
    }), "utf8");

    const { stdout } = await execFile("node", [
        cliPath,
        "uninstall-agent-support",
        "--vault-root",
        vaultRoot,
        "--skills-root",
        skillsRoot,
    ], {
        cwd: process.cwd(),
    });

    assert.match(stdout, new RegExp(`Removed SideNote2 AGENTS\\.md content and deleted ${agentsPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`));
    assert.match(stdout, /No bundled SideNote2 skills found/);
    await assert.rejects(access(agentsPath));
});
