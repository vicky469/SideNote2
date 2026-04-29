# File Sidebar Local Tags Plan

## Goal

Add a new note-sidebar tab sequence:
`List | Tags | Thought Trail`
for individual markdown files, with local tag filtering and batch tag assignment from search results.

## Scope

- In scope: file-sidebar modes, local tag indexing from comment text, search filtering, batch apply workflow.
- Out of scope: index-sidebar behavior, global tag taxonomy changes, schema migrations.

## Required behavior (simple)

1) Tabs
- Add `Tags` mode to file-sidebar controls.
- Keep mode order as `List`, `Tags`, `Thought Trail`.
- Keep `Tags` hidden on index-sidebar surface.

2) Local tag view
- Build tag aggregates from active-file comments only.
- Use existing Obsidian tag parsing behavior (`extractTagsFromText`, `normalizeTagText`).
- `Tags` filter and search operate only on comments from the active markdown file.

3) Search-to-batch flow
- Search result list supports multi-select in file-sidebars.
- Batch toolbar appears when selection non-empty.
- Tag input supports:
  - existing local tag lookup
  - create-on-miss in same input
- Applying tag appends to existing tags (no replace).

4) Mode and scope safety
- Search in `Tags`/`List` does not auto-switch mode out of `Tags`.
- Batch mutation runs only on active-file thread IDs.
- Invalid saved mode should safely fall back (`list`/`thought-trail` behavior remains).

5) Failure handling
- Partial success is allowed.
- Keep successful updates; report failed thread IDs inline.
- Cancel keeps selection so user can retry.

## Implementation checklist

1) Data model
- Extend mode union to include `tags`.
- Add lightweight local tag index (`FileTagIndex`) for active file.
- Add minimal batch flow state (`isOpen`, `isApplying`, `query`, selected tag, candidates, failures).

2) Sidebar wiring
- Add `Tags` tab in note mode control.
- In `Tags` mode, render tag filter + searchable batch toolbar.
- Keep existing `Thought Trail` behavior otherwise unchanged.

3) Search + filtering
- Reuse current search input/debounce logic.
- Apply file-local visibility + active tag filter.

4) Batch action execution
- Collect selected thread IDs from current visible set.
- Validate selection scope against active file.
- Append missing tag key per thread.
- Keep existing selected IDs after apply for quick retry.

5) UX polish
- Empty states for: no search result, no tag match, no selected items.
- Keep panel close/cancel behavior explicit and reversible.

## Success criteria

- File sidebars show `List | Tags | Thought Trail`.
- Batch tag input can choose existing local tags and create missing tags.
- Appending behavior is preserved.
- No cross-file mutation.
- Existing users without tags experience unchanged baseline behavior.
