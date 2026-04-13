# Private Source / Public Release Split Spec

## Status

Draft implementation spec based on:

- [../todo/todo-private-source-public-release-split.md](../todo/todo-private-source-public-release-split.md)

## Objective

Split SideNote2 into:

1. a private source repo that contains development code and full history
2. a public release repo that contains only shipped plugin artifacts and public-facing folders like skills, scripts, and assets.

The result should make the release boundary explicit:

- source code stays private
- shipped plugin files stay public
- the public repo remains installable by Obsidian users
- runtime data such as `data.json` and log files still live inside the user's vault plugin folder, not inside the source repo

## Scope

In scope:

- repo topology for private source vs public release
- public repo file allowlist
- publish flow from private to public
- artifact verification before publish
- handling of release metadata such as `manifest.json` and `versions.json`
- runtime expectations for plugin-local files like `data.json` and `logs/`

Out of scope:

- rewriting already-published public history
- community release automation details beyond the publish contract
- moving user vault content
- changing how Obsidian loads installed plugins

## Core Rules

### Rule 1: Source And Release Repos Have Different Purposes

The private source repo is the development system of record.
The public release repo is a distribution repo only.

The public repo must not be treated as the place where feature work happens.

### Rule 2: Public Repo Uses An Explicit Allowlist

The public release repo must contain only files that are intentionally shipped or intentionally public.

Ignore-based packaging is not enough.
The release boundary must be visible from the repo contents themselves.

### Rule 3: Runtime Files Belong To The Installed Plugin Directory

When a user installs the plugin in a vault, runtime-generated files live under:

- `{{vault}}/.obsidian/plugins/side-note2/`

Examples:

- `data.json`
- `logs/*.jsonl`

This rule is independent of where the source repo lives.
The source repo must not become the long-term home for runtime user data in a release install.

### Rule 4: Public Releases Must Be Artifact-Inspected

Before updating the public release repo, inspect the exact shipped artifact set and block publish if it contains:

- source maps with embedded `sourcesContent`
- raw `.ts`, `.tsx`, `.jsx`, or similar source files
- tests
- local-only docs or notes
- secrets or machine-local files

### Rule 5: Publish Is One-Way

The private source repo publishes into the public release repo.
The public release repo does not publish back into the source repo.

## Repo Topology

### Private Source Repo

Suggested name:

- `SideNote2-source`

Contains:

- `src/`
- `tests/`
- build scripts
- local development docs
- CI for test/build/publish
- full implementation history

### Public Release Repo

Suggested name:

- `SideNote2`

Contains only the public install surface and public release materials.

## Public Repo Allowlist

Required shipped files:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`
- `README.md`
- `LICENSE`

Allowed public release assets/docs:

- `assets/` only for assets intentionally referenced by the public README or release materials
- `skills/sidenote2/`
- public helper scripts:
  - `scripts/append-note-comment-entry.mjs`
  - `scripts/update-note-comment.mjs`
  - `scripts/resolve-note-comment.mjs`
- release notes or narrowly scoped public docs, if explicitly chosen

Must not be present in the public repo:

- `src/`
- `tests/`
- internal skills such as `skills/dev/`
- internal planning docs
- internal todo notes
- internal architecture notes
- build-only config that is not needed by end users
- local development scripts unless deliberately made public

## Runtime Storage Contract

### Installed Release

For a normal user install, the plugin runtime root is:

- `{{vault}}/.obsidian/plugins/side-note2/`

Runtime-generated files must resolve relative to that installed plugin directory.

Examples:

- `{{vault}}/.obsidian/plugins/side-note2/data.json`
- `{{vault}}/.obsidian/plugins/side-note2/logs/2026-04-13.jsonl`

### Local Development Checkout

When the plugin is loaded directly from a local checkout, runtime files may live beside that checkout because the checkout itself is acting as the installed plugin directory.

This is acceptable for development only.
It must not redefine the release install contract.

### Logging Rule

Persistent logs are part of runtime data, not release artifacts.

So:

- log implementation code belongs in the private source repo
- generated log files belong in the installed plugin directory inside the user's vault
- generated log files must not be committed to the public release repo

## Publish Workflow

### Step 1: Build In Private Source Repo

Build the production artifact in the private source repo.

Required outputs:

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

### Step 2: Inspect Release Artifact

Run the release artifact guard against the exact files that will be published.

Block publish if inspection finds:

- exposed source code
- source maps with embedded source
- non-public docs
- secret-bearing files

### Step 3: Update Public Release Repo

Publish only the allowed public files into the public release repo.

This can be done by:

- a publish script
- a CI job in the private repo
- a release bot with scoped access

Current private-repo implementation:

- `npm run public-release:export` writes the exact allowlisted public snapshot
- `npm run public-release:publish` pushes that snapshot to the `public` git remote
- the private source repo keeps `origin` pointed at `SideNote2-source`
- the public release repo is tracked as the `public` remote

### Step 4: Tag And Release

The public release repo remains the user-facing release surface:

- tags
- GitHub releases
- install instructions
- `versions.json`

## Versioning Rules

- `manifest.json.version`
- `versions.json`
- public release tag

must stay aligned for a shipped release.

If release metadata is updated, the private publish step must carry that update into the public repo in the same publish transaction.

## Migration Plan

1. Create the private source repo from the current full repo state.
2. Create or repurpose the public repo as a release-only repo.
3. Define the exact public allowlist in code or CI, not just in prose.
4. Add a publish path from private source to public release.
5. Verify that release installs still read and write runtime files under `{{vault}}/.obsidian/plugins/side-note2/`.
6. Decide separately whether historical public source exposure should be rewritten or left as legacy history.

## Current Implementation Notes

The private source repo should enforce this boundary with:

- an explicit export/check script
- a release check that runs the public release guard after production build

That guard should validate the exact public tree rather than inferring it from gitignore rules.

## Acceptance Criteria

This split is complete when all of the following are true:

1. Feature development happens only in the private source repo.
2. The public repo contains only the approved allowlist.
3. The public repo is sufficient for Obsidian users to install the plugin.
4. No generated runtime files are tracked in the public repo.
5. A release install writes `data.json` and `logs/` under `{{vault}}/.obsidian/plugins/side-note2/`.
6. Release publish is blocked if artifact inspection finds source exposure.
