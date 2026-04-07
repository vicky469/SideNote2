---
name: side-note2-note-comments
description: Use when reading or editing SideNote2-backed Obsidian notes. Covers finding the relevant markdown note in the vault, reading the note body plus trailing `<!-- SideNote2 comments -->` JSON block, identifying stored comments by `id` or `selectedText`, and using the repo helper script or direct note edits when the user asks the agent to write changes.
---

# SideNote2 Obsidian Notes

Use this skill when the user wants work done against real Obsidian notes that use SideNote2 note-backed comments.

## Scope

- Read note content directly from markdown files in the vault.
- Read SideNote2 comment data from the trailing `<!-- SideNote2 comments -->` block in the same note.
- Write note content directly when the user asks to edit the note body.
- Write SideNote2 comment bodies through the helper script when possible.
- Append new entries to an existing SideNote2 thread when the user says things like `reply`, `answer in the side comment`, `add another note under this`, or `add to thread`.

## Replacement Lookup Paths

Use one of these two paths to locate the side comment that should be replaced:

1. `SideNote2 index.md`
   - Use this to discover the note path and comment target when the user refers to a side comment indirectly.
   - Treat it as a jump index only, not canonical storage.
2. The user’s active note in source mode
   - Use the trailing `<!-- SideNote2 comments -->` block at the bottom of the active markdown note.
   - Treat this as the authoritative source when reading or writing a stored comment.

## Finding Notes

1. Prefer an explicit absolute path from the user.
2. Resolve the actual Obsidian vault root before searching broadly.
   - Do not assume the plugin repo root is the vault root.
   - If Obsidian CLI is available, check `obsidian vaults verbose` to map vault names to paths.
   - Check `~/.config/obsidian/obsidian.json` for vault entries marked `"open": true` when you need the vault(s) currently open in Obsidian.
   - Check `<vault>/.obsidian/workspace.json` for the current workspace state, active leaves, and recent files when you need the note the user is actively working in.
   - If the repo is nested inside a larger vault, search the outer vault root for notes and keep the repo root only for helper scripts.
3. If the user gives only a note title or fragment, search the resolved vault root for matching `.md` files.
4. Treat the markdown note itself as the source of truth.
5. Do not rely on the Obsidian UI state alone when the note file can be read directly.

## Reading Workflow

1. Confirm the target note path.
2. If needed, use `SideNote2 index.md` to find the relevant note path first.
3. Open the note itself, not just plugin code or generated index files.
4. Read both:
   - the main markdown content
   - the trailing `<!-- SideNote2 comments -->` block, if present
5. When the user asks about a specific side note:
   - match by `id` if available
   - otherwise match by `selectedText` and surrounding context
   - do not rely on `timestamp` if a stronger identifier exists

## Writing Workflow

If the user asks to edit the note body:

1. Edit the markdown note directly.
2. Preserve the trailing SideNote2 managed block unless the task explicitly changes comments.

If the user asks to add a page-level tag in a SideNote2 note:

1. Inspect the note's leading YAML frontmatter only if it starts at the top of the file.
2. If that frontmatter already contains a `tags` field, add the tag there and avoid duplicates.
3. Preserve the note's existing `tags` style when practical, such as a YAML list versus inline form.
4. If the note does not have a leading frontmatter `tags` field, do not create one just for this request.
5. In that fallback case, add the tag as a SideNote2 page note instead.

If the user asks to reply to a side comment, answer a question in a side comment, add another note under a side comment, add to thread, or split one longer side comment into several short notes in the same place:

1. Treat this as an append-to-thread request.
2. Do not overwrite the existing comment body unless the user explicitly asks to edit or rewrite that entry.
3. Do not create a separate markdown file just to continue the same side comment thread.
4. Confirm the target note path.
5. Identify the target thread by `id` when it is available.
   - If `id` is not provided, match by `selectedText` and surrounding note context.
   - If multiple stored comments in the same note share the same `selectedText`, ask for more context or use the `id`.
6. Prefer the append helper script from the repo root:

```bash
cd "/abs/path/to/SideNote2"
node scripts/append-note-comment-entry.mjs --file "/abs/path/to/note.md" --id "<comment-id>" --comment-file "/abs/path/to/reply.md"
```

Short replies can use `--comment "Reply body"` instead of `--comment-file`.
If Sync is active, add `--settle-ms 2000` here too so the script skips notes that changed after it read them instead of overwriting them.

7. If the note is outside the writable workspace, request escalation before running the script.
8. If the helper script cannot be used, append one new object to the end of the target thread's `entries[]` array and preserve all existing entries.
9. Use this pattern for:
   - answering a question the user wrote inside an existing side comment
   - splitting one comment into multiple shorter thread entries for readability, similar to a short post thread
10. Verify that only the target thread changed and that exactly one new entry was appended.

If the user asks to edit a stored SideNote2 comment:

Use this workflow only when the user wants to replace or rewrite an existing stored comment body. If the user says `reply`, `add another note under`, `continue this`, or similar, use the append-to-thread workflow above instead.

1. Confirm the target note path.
2. If needed, use `SideNote2 index.md` to locate the target note and comment first.
3. Inspect the trailing `<!-- SideNote2 comments -->` block in the active markdown note.
4. Identify the target comment by `id` when it is available.
   - Natural-language requests such as `Update the side comment for "selected text" in "/path/to/note.md" to: ...` should be interpreted as a `selectedText`-based replacement request.
   - Natural-language requests such as `Reply to the side comment for "selected text"` or `Add another note under this side comment` are append-to-thread requests, not replacement requests.
   - If `id` is not provided, match by `selectedText` and surrounding note context.
   - If multiple stored comments in the same note share the same `selectedText`, ask for more context or use the `id`.
5. Prefer the helper script from the repo root:

```bash
cd "/abs/path/to/SideNote2"
node scripts/update-note-comment.mjs --file "/abs/path/to/note.md" --id "<comment-id>" --comment-file "/abs/path/to/comment.md"
```

Short replacements can use `--comment "New body"` instead of `--comment-file`.
If Sync is active, add `--settle-ms 2000` here too so the script skips notes that changed after it read them instead of overwriting them.

6. If the note is outside the writable workspace, request escalation before running the script.
7. Verify the note still contains exactly one managed block and that only the target comment thread or entry body changed.

## Important Details

- SideNote2 stores comments as strict JSON in the trailing hidden block.
- Treat threaded `entries[]` storage as canonical. Starting in SideNote2 `2.0.1`, the plugin auto-migrates older flat note-comment payloads on startup, so agents should not build manual legacy migration steps into normal workflows.
- In threaded storage, `entries[]` order is meaningful. Replies and `add another note under this` requests should usually append one new entry at the end.
- Use `scripts/append-note-comment-entry.mjs` for append-to-thread requests and `scripts/update-note-comment.mjs` only for replacement requests.
- The helper scripts write atomically and skip notes that changed after the initial read. Treat a skipped note as a retry case, not as a signal to hand-edit the managed JSON.
- Multiline comment bodies must stay JSON-escaped in source; do not paste raw block text into the JSON string by hand unless necessary.
- The note itself is the source of truth. Sidebar state and aggregate views are derived from the note.
- `SideNote2 index.md` is generated output, not canonical storage.

## Fallback

If the helper script cannot be used:

1. Edit the source-mode block directly.
2. Preserve `id`, anchor coordinates, `selectedText`, `selectedTextHash`, timestamps, and `resolved`.
3. For replacement requests, change only the target `entries[*].body`.
4. For append-to-thread requests, append one new object to the target thread's `entries[]` array without modifying the existing entries.
5. If a note still shows an old flat `comment` payload unexpectedly, stop and ask the user to open the vault once in SideNote2 `2.0.1+` so the startup migration can finish instead of hand-migrating JSON in the agent workflow.
