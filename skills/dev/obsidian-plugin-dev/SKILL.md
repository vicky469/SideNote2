---
name: obsidian-plugin-dev
description: Use when building, debugging, reviewing, releasing, or submitting an Obsidian community plugin. Covers typical plugin repos (`manifest.json`, `package.json`, `versions.json`, `src/main.ts`, `styles.css`), official Obsidian developer docs, API typings, sample-plugin patterns, and release/submission requirements.
---

# Obsidian Plugin Dev

## Quick Start

- Use this skill for any Obsidian community plugin task: new features, bug fixes, refactors, code review, build issues, release prep, or submission requirements.
- Start with the local plugin repo first: inspect `manifest.json`, `package.json`, `versions.json`, `src/main.ts`, `styles.css`, and existing build or test scripts.
- Prefer the local reference bundle in `references/` over scraping the docs website.
- If references are missing or stale, run `scripts/sync_references.sh`.

## Workflow

1. Classify the task before editing.
   - Build or repo setup: use sample-plugin + developer docs getting started pages.
   - API usage: use `references/api/obsidian-api/*.d.ts` first, then the markdown API pages.
   - UI work: use the developer docs user-interface pages plus sample-plugin structure.
   - Editor or CodeMirror work: use the developer docs editor pages plus typings.
   - Release or submission: use the developer docs releasing pages plus help pages under extending Obsidian.
2. Read only the references needed for the task.
3. Follow the existing repo’s structure unless the user explicitly wants a migration.
4. Validate with the repo’s own build or test commands when possible.

## Repo Skill Routing

- In this repo, treat the repo-local `skills/*/SKILL.md` files as the canonical agent instructions.
- Use this skill for general plugin repo, API, UI, build, release, and review work.
- When the task is about real SideNote2-backed vault notes, hidden `<!-- SideNote2 comments -->` blocks, or helper-script based note comment edits, switch to `skills/side-note2-note-comments/SKILL.md`.
- Do not keep separate Claude-only and Codex-only copies of the same repo-local skill text unless the workflows genuinely diverge.
- If you need to test the packaged global install flow from this repo, run `npm run skill:install` or `npm run skill:install -- --name obsidian-plugin-dev`.

## Review Workflow

- For isolated repo review, have the main agent or orchestrator prepare a read-only review bundle instead of exposing the live worktree to the reviewer.
- In this repo, use `npm run review:bundle -- --output /tmp/side-note2-review`.
- Hand the resulting directory to the reviewer read-only.
- The reviewer should inspect:
  - `snapshot/` for the current worktree state without `.git`
  - `status.txt` for tracked and untracked changes
  - `review.patch` for the diff against the chosen base ref
- Prefer this over trying to launch a nested sandbox inside the reviewer worker.

## Reference Sets

- `references/reference-map.md`
  Use first. It maps common plugin tasks to the right local docs.
- `references/developer-docs/Plugins/`
  Core plugin guides: getting started, UI, editor, events, vault access, releasing.
- `references/developer-docs/Reference/TypeScript API/`
  One markdown page per exported API symbol.
- `references/developer-docs/Reference/CSS variables/`
  Use for styling against built-in tokens instead of hardcoded colors.
- `references/api/obsidian-api/`
  Canonical typings: `obsidian.d.ts`, `canvas.d.ts`, `publish.d.ts`.
- `references/help/Extending Obsidian/`
  Runtime-facing docs such as community plugins, plugin security, URI, CLI, and headless notes.
- `references/help/Contributing to Obsidian/Developers.md`
  Useful when working near docs or contribution workflows.
- `references/sample-plugin/`
  Baseline file layout and implementation patterns.

## Search Patterns

- Find common plugin hooks in typings:
  `rg -n "registerEvent|registerView|addCommand|addSettingTab|addRibbonIcon|registerEditorExtension" references/api/obsidian-api/obsidian.d.ts`
- Find UI guidance:
  `rg -n "Commands|Settings|Views|Modals|Ribbon|Workspace|Context menus" references/developer-docs/Plugins/User\\ interface`
- Find editor guidance:
  `rg -n "Editor extensions|Markdown post processing|Decorations|State fields|View plugins" references/developer-docs/Plugins/Editor`
- Find release requirements:
  `rg -n "Submit your plugin|Plugin guidelines|Submission requirements|GitHub Actions" references/developer-docs/Plugins/Releasing`
- Find runtime integration docs:
  `rg -n "Community plugins|Plugin security|Obsidian URI|Obsidian CLI|Obsidian Headless" references/help/Extending\\ Obsidian`

## Obsidian-Specific Heuristics

- Keep `manifest.json` id stable unless the user explicitly wants a rename.
- If the version changes, update `versions.json` alongside `manifest.json`.
- Register cleanup through the plugin lifecycle and unload handlers.
- Prefer official CSS variables over raw hardcoded colors when styling plugin UI.
- For icon-only buttons, prefer Obsidian's `clickable-icon` pattern.
- Do not duplicate the same label in both `aria-label` and `title` on icon-only buttons.
- If an icon-only control already has a clear `aria-label`, omit `title` unless it adds distinct information.
- Be careful with desktop-only or Node-only APIs if the plugin may run on mobile.
- For unfamiliar symbols, check the typings before inventing patterns from memory.
- Prefer the sample plugin’s repo shape unless the target repo already uses another proven setup.

## Refreshing References

- Run `scripts/sync_references.sh` when the user asks for the latest docs, when a reference is missing, or before major release/submission work.
- The sync script is repo-first. It pulls official upstream sources and copies curated local subsets into `references/`.
