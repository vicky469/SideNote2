# Button State

This note is only about the top note-sidebar buttons.

The goal is to make button behavior easy to scan without reading controller code.

## State Axes

| Axis              | Values                       | Meaning                                                   |
| ----------------- | ---------------------------- | --------------------------------------------------------- |
| `primaryMode`     | `list`, `thought-trail`      | Which sidebar layout is active                            |
| `contentFilter`   | `all`, `bookmarks`           | The note-toolbar content filter                           |
| `resolvedFilter`  | `active`, `resolved`         | Whether we show active or resolved threads                |
| `deletedMode`     | `false`, `true`              | Whether deleted-thread mode is active                     |
| `pinnedThreadIds` | `Set<string>`                | Extra pin filter applied on top of the current result set |
| `searchQuery`     | text                         | Search within the current filtered set                    |

## Button State

| Button | Active when | Click effect |
| --- | --- | --- |
| Bookmark toolbar button | `contentFilter === "bookmarks"` | Toggle between `bookmarks` and `all` |
| Resolved button | `resolvedFilter === "resolved"` | Toggle between `resolved` and `active` |
| Pin on a card | `pinnedThreadIds.has(thread.id)` | Add/remove that thread id from the pin set |

## Click Outcomes

| Current state | User action | Next state | Expected visible result |
| --- | --- | --- | --- |
| `contentFilter = all` | Click bookmark toolbar button | `contentFilter = bookmarks` | Show only bookmarked threads |
| `contentFilter = bookmarks` | Click bookmark toolbar button again | `contentFilter = all` | Return to all active threads |
| `contentFilter = bookmarks`, `resolvedFilter = active` | Click resolved button | `resolvedFilter = resolved` | Show resolved bookmarked threads |
| `contentFilter = bookmarks`, one visible card | Click pin on that card | Add thread id to `pinnedThreadIds` | Keep only the intersection of bookmark filter and pin filter |
| `contentFilter = bookmarks`, one bookmarked card visible | Click bookmark on that card to remove bookmark | Keep `contentFilter = bookmarks` | Card disappears immediately; view becomes empty if nothing else matches |

## Rule

The visible sidebar list should always come from one pipeline:

1. start from loaded threads for the current note
2. apply deleted visibility
3. apply resolved visibility
4. apply content filter
5. apply pin filter
6. apply search filter

If a button interaction cannot be explained by this table plus this pipeline, the state model is unclear.
