# SideNote2

<p align="center">
  <img src="./logo.svg" alt="SideNote2 logo" width="72">
</p>

SideNote2 is an [Obsidian](https://obsidian.md) plugin for side comments that stay attached to the note.

It is built for a minimal workflow: humans work in the sidebar, while agents can read the same comments directly from the markdown file. Inspired by [mofukuru/SideNote](https://github.com/mofukuru/SideNote).

## Features

- Uses a dedicated sidebar for drafting, editing, resolving, reopening, and deleting comments.
- Supports Obsidian-style `[[wikilinks]]` inside side comments to link existing notes or create new markdown notes.
- Highlights commented text directly in the note.
- Keeps resolved comments archived instead of removing them.
- Generates `SideNote2 index.md` as a vault-wide comment index.
- Supports Codex CLI workflows so agents can read and update side comments from the note-backed storage format.

## Workflow

1. Select text in a note.
2. Right-click `Add comment to selection`.
   You can use the ribbon button to open the sidebar, or assign your own hotkey in Obsidian.
3. Write the comment in the sidebar.
4. Review it later from the sidebar.

For power users:

Agents can read the same note directly from markdown, including the trailing `<!-- SideNote2 comments -->` block.

In Codex CLI, you can ask for a stored side comment directly:

```text
Show me the side comment for "selected text" in "/Users/path/to/note.md".
```

Or update it without knowing the underlying command:

```text
Update the side comment for "selected text" in "/Users/path/to/note.md" to:
Your new side comment text here.
```

If multiple side comments in the same note use the same selected text, include a little more nearby context or the comment id.

## Settings

- `Debug mode`
  This is not implemented yet. 

## Command

- `SideNote2: Add comment to selection`

## Storage

Each note stores its comments in a trailing hidden `<!-- SideNote2 comments -->` JSON block inside the same markdown file.

`SideNote2 index.md` is just a generated index, not separate storage.

## Development

Setup, local vault install, debugging, and architecture notes live in [README-dev.md](./README-dev.md).

## License

MIT
