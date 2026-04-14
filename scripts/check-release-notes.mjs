#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function resolveVersion() {
	const fromCli = process.argv[2]?.trim();
	if (fromCli) {
		return fromCli;
	}

	const fromEnv = process.env.npm_package_version?.trim();
	if (fromEnv) {
		return fromEnv;
	}

	const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
	return String(packageJson.version ?? "").trim();
}

function assertReleaseVersion(version) {
	if (!/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error(`Expected a semver release version, received: ${version || "<empty>"}`);
	}
}

function assertReleaseNotesContent(content, releaseNotesPath) {
	const trimmed = content.trim();
	if (!trimmed) {
		throw new Error(`Release notes file is empty: ${releaseNotesPath}`);
	}

	const forbiddenTemplateSnippets = [
		"Write the short human summary here.",
		"- Highlight 1",
		"- Highlight 2",
	];

	for (const snippet of forbiddenTemplateSnippets) {
		if (trimmed.includes(snippet)) {
			throw new Error(`Release notes file still contains template placeholder content: ${releaseNotesPath}`);
		}
	}
}

function main() {
	const version = resolveVersion();
	assertReleaseVersion(version);

	const releaseNotesPath = path.join("docs", "releases", `${version}.md`);
	if (!existsSync(releaseNotesPath)) {
		throw new Error(`Missing required release notes file: ${releaseNotesPath}`);
	}

	const releaseNotes = readFileSync(releaseNotesPath, "utf8");
	assertReleaseNotesContent(releaseNotes, releaseNotesPath);

	process.stdout.write(`Release notes check passed: ${releaseNotesPath}\n`);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
