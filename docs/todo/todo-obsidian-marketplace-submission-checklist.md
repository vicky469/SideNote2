# TODO: Obsidian Plugin Submission Checklist

Checked against the official Obsidian docs and local repo guidance on 2026-04-14:

- `Obsidian October plugin self-critique checklist`
- `Submit your plugin`
- `Submission requirements for plugins`
- `Plugin guidelines`
- `Plugin security`
- `obsidian-plugin-dev` skill guidance
- local `AGENTS.md` release artifact security rules

## Repository And Metadata

- [x] Root repo has `README.md`, `LICENSE`, and `manifest.json`.
- [x] The plugin source is public on GitHub at `vicky469/SideNote2`.
- [x] `manifest.json` uses a valid semver version: `2.0.12`.
- [x] `versions.json` includes `2.0.12`.
- [x] `package-lock.json` is committed.
- [x] `fundingUrl` only points to financial support.
- [x] Plugin id is `side-note2`, which does not contain `obsidian`.
- [x] `side-note2` is not already present in Obsidian's current `community-plugins.json` as of 2026-04-14.

## Compatibility And Runtime

- [x] Decided desktop-only and set `manifest.json` `isDesktopOnly` to `true` because the shipped plugin uses Node `path`, `electron`, and `FileSystemAdapter` paths.
- [x] Updated `minAppVersion` to `1.12.7` to match the latest public Obsidian desktop release as of 2026-03-23.
- [x] Command text does not include the plugin name or plugin id.
- [x] No default hotkeys are registered in code.

## Documentation And User Disclosures

- [x] `README.md` explains what the plugin does and how to use it.
- [ ] Add an explicit security and disclosures section to `README.md`.
- [ ] In that disclosure section, state that the plugin is desktop-only.
- [ ] In that disclosure section, state whether the plugin requires any account. Current repo state suggests no account is required.
- [ ] In that disclosure section, state whether the plugin shows ads. Current repo state suggests no ads.
- [ ] In that disclosure section, state whether the plugin includes telemetry. Current repo state suggests no telemetry.
- [ ] In that disclosure section, explain current network-related behavior. Today the main user-reachable case is the index header image URL setting, and the default index image URL is remote.
- [ ] Decide whether to keep the default remote index header image URL. If keeping it, document that the generated index note may load a remote image. If not, replace the default with a blank or local-safe default.
- [ ] In that disclosure section, explain that support-report sending code exists in the repo but is currently disabled in this build because no endpoint is configured.
- [ ] If a future build enables support-report sending, disclose exactly what leaves the device: email, title, report body, attached log content, and optional screenshots.
- [x] Added vulnerability reporting instructions in `README.md`, and added a GitHub bug report template with a security contact link.

## Security And Code Review

- [x] No telemetry or analytics SDKs were found in `src/` or `package.json`.
- [x] Support-report sending code uses Obsidian `requestUrl` instead of `fetch`.
- [x] The current build has no active support-report endpoint because `src/support/supportConfig.ts` sets `SUPPORT_REPORT_ENDPOINT_URL` to `null`.
- [x] Reviewed and trimmed non-essential console output so routine startup and warning-level plugin events stay in SideNote2 logs instead of the default console.
- [ ] Audit remaining HTML injection sinks and either document why they are safe or replace them with safer DOM construction. Current sinks to review are `SupportLogInspectorModal.ts`, `SideNote2View.ts` Mermaid SVG rendering, `sidebarDraftComment.ts`, and `sidebarPersistedComment.ts`.

## Release Artifact Security

- [x] GitHub release `2.0.12` exists and ships `main.js`, `manifest.json`, and `styles.css`.
- [x] The production build already blocks `main.js.map`, `sourceMappingURL`, and `sourcesContent`.
- [x] Release policy already requires inspecting the shipped artifacts `main.js`, `manifest.json`, and `styles.css`.
- [ ] Before each public release, inspect the exact shipped artifacts and confirm they do not expose raw TypeScript, embedded source maps, secrets, test fixtures, or local-only files.

## Submission Workflow

- [ ] Submit the plugin entry to `obsidianmd/obsidian-releases/community-plugins.json`.
- [ ] Open the submission PR with title `Add plugin: SideNote2`.
- [ ] Fill in the PR template and wait for the validation bot to mark it `Ready for review`.

## After Submission

- [ ] Address review comments in the same PR.
- [ ] If Obsidian asks for changes, cut a new GitHub release and update the same submission PR instead of opening a new one.

## Meta

- [x] Added this marketplace-submission checklist workflow to the shared `obsidian-plugin-dev` skill so it is part of future release/submission prep by default.

## Notes

- The repo contains support-report UI and sender code, but I did not find an active runtime wiring that opens `SupportReportModal` in the current build.
- The plugin currently writes local diagnostic logs under the plugin directory and can reveal the log file location on desktop. That behavior should be mentioned in user-facing disclosures if it remains part of the public release.
