# Agent Mentions Spec

## Status

Draft implementation spec based on:

- [agent-mentions-prd.md](agent-mentions-prd.md)
- [architecture.md](../architecture.md)

## Objective

Implement phase 1 agent delegation for explicit `@codex` and `@claude` mentions inside SideNote2-managed threads.

This spec turns the PRD plus the answered sidebar questions into concrete implementation requirements for:

- directive parsing
- post-persist dispatch
- durable run storage
- runtime invocation
- agent reply append behavior
- index sidebar `Agent` mode
- retry behavior
- tests

## Final Decisions

These decisions are closed for phase 1:

- auto-dispatch happens only for newly saved user entries in `new` or `append` mode
- editing an existing triggering entry never auto-dispatches
- explicit retry creates a new run record
- the runtime working directory is the active vault root
- raw agent reply text is the only note-body output
- execution metadata stays in plugin data
- the existing index sidebar `Agent` tab is the only dedicated phase-1 agent surface
- no second active-runs panel is added

## Scope

In scope:

- semantic parsing for `@codex` and `@claude`
- one durable run record per triggered save or explicit retry
- a global FIFO queue with one active run at a time
- runtime dispatch through an `AgentRuntimeAdapter`
- raw reply append back into the same thread
- index sidebar `Agent` tab
- status rendering for queued, running, succeeded, failed
- explicit retry from agent-involved threads
- desktop/runtime-precondition handling

Out of scope:

- generic `@agent` auto-dispatch
- multi-agent fan-out from one saved entry
- per-note or frontmatter workspace mapping
- multiple concurrent runtime executions
- structured note-body execution summaries
- chain-of-thought or thinking-step storage
- source-note agent tabs outside the index sidebar
- direct note writes by the external runtime

## Product Rules

### Rule 1: Explicit Targets Only

Phase 1 auto-dispatch recognizes only:

- `@codex`
- `@claude`

The existing `preferredAgentTarget` setting must not override explicit mention text.

### Rule 2: Auto-Dispatch Happens Only After Canonical Save

SideNote2 persists the user entry first.
Only after the note write succeeds may agent dispatch begin.

### Rule 3: Only New User Saves Auto-Dispatch

Auto-dispatch is allowed only when the saved draft mode is:

- `new`
- `append`

Saved edits never auto-dispatch.

### Rule 4: Retry Is Explicit

Retry is a user action, not a save side effect.
Every retry creates a new run record and preserves earlier runs for history.

### Rule 5: One Saved Entry Produces At Most One Run

One saved entry may create:

- zero runs if no valid directive exists
- one run if exactly one valid target exists

If one saved entry contains conflicting explicit targets, SideNote2 must not auto-dispatch.

### Rule 6: Runtime Working Directory Is The Active Vault Root

Phase 1 uses the active vault root as the runtime working directory.
Do not add:

- workspace-root settings
- per-note mapping
- frontmatter mapping
- folder-based mapping

### Rule 7: Raw Reply Text Only

The appended agent reply entry stores only the reply text.
Run status, timestamps, errors, and output linkage live in plugin data only.

### Rule 8: The `Agent` Tab Reuses List Controls

The index sidebar `Agent` tab must reuse the same controls as `List`:

- `Files`
- resolved visibility
- nested-comment visibility

## Directive Parsing Spec

## Recognition Rules

Add a new parser module:

- `src/core/text/agentDirectives.ts`

Parsing should mirror the current mention-token boundary rules used in:

- `src/ui/editor/commentEditorStyling.ts`

Minimum rules:

- match `@codex` and `@claude` as standalone mention tokens
- do not treat emails as directives
- repeated mentions of the same target count as one directive
- conflicting targets in one entry are invalid for auto-dispatch

Recommended output shape:

```ts
type AgentDirectiveTarget = "codex" | "claude";

interface AgentDirectiveResolution {
  target: AgentDirectiveTarget | null;
  hasConflict: boolean;
  matchedTargets: AgentDirectiveTarget[];
}
```

## Parsing Scope

Directive parsing runs only for:

- newly saved user thread parents
- newly saved user child entries
- explicit retry on a previously saved triggering entry

It does not run for:

- agent-generated reply entries
- edited entries during normal save

## Runtime Availability And Working Directory

## Working Directory

Use the vault root from the active Obsidian vault adapter:

- `app.vault.adapter instanceof FileSystemAdapter`
- `app.vault.adapter.getBasePath()`

This aligns with the existing runtime path access already used in `main.ts`.

## Unsupported Environments

If the vault root cannot be resolved, SideNote2 must:

- keep the saved user entry
- create a failed run record
- attach a concise environment error
- avoid starting any external runtime process

Phase 1 should treat this as unsupported runtime execution, which is expected on environments without a filesystem-backed vault.

## Runtime Selection

Phase 1 hardcodes one runtime adapter family:

- `openclaw-acp`

Explicit mention text selects the harness alias:

- `@codex` -> `codex`
- `@claude` -> `claude`

The existing `preferredAgentTarget` setting remains non-authoritative for explicit mentions and may be reused later for generic agent affordances.

## Data Model

## Note Schema

Do not change the thread entry schema in note-backed comments.

Agent-produced replies remain normal appended child entries.
Agent identity is derived from run records, not stored in the note body schema.

## Run Record

Add a dedicated run type module, recommended file:

- `src/core/agents/agentRuns.ts`

Recommended phase-1 shape:

```ts
type AgentRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface AgentRunRecord {
  id: string;
  threadId: string;
  triggerEntryId: string;
  filePath: string;
  requestedAgent: "codex" | "claude";
  runtime: "openclaw-acp";
  status: AgentRunStatus;
  promptText: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  retryOfRunId?: string;
  outputEntryId?: string;
  error?: string;
}
```

## Plugin Data Persistence

Extend persisted plugin data with agent runs.

Recommended direction:

- keep settings normalization in `indexNoteSettingsPlanner.ts`
- add agent-run normalization in a dedicated store/planner instead of mixing queue logic into settings code

Recommended store files:

- `src/control/agentRunStore.ts`
- `src/control/agentRunStorePlanner.ts`

`PersistedPluginData` should grow a new field:

```ts
agentRuns?: unknown;
```

## Queue And Lifecycle

## Queue Model

Add a queue owned by:

- `src/control/commentAgentController.ts`

Phase 1 queue rules:

- global FIFO
- one active run at a time
- queued runs survive reload as persisted records
- persisted `queued` or `running` runs from a previous session are normalized to `failed` on startup

This avoids pretending an external ACP session survived an Obsidian restart.

## Post-Persist Trigger Point

Use `CommentMutationController` as the post-persist trigger point because it already knows:

- save mode
- saved entry id
- target file path
- whether canonical persistence succeeded

Concrete requirement:

- after a successful `new` or `append` save, call `CommentAgentController.handleSavedUserEntry(...)`
- do not call this after `edit` saves

Recommended payload:

```ts
interface SavedUserEntryEvent {
  threadId: string;
  entryId: string;
  filePath: string;
  body: string;
}
```

## Retry Flow

Phase 1 requires an explicit retry action.

Retry behavior:

1. identify the latest run for the thread
2. load the current saved body of that run's `triggerEntryId`
3. parse directives again from that current saved body
4. if no valid explicit target remains, do not retry
5. if valid, create a new run record with `retryOfRunId`

This keeps explicit text authoritative even after the user edits the triggering entry.

## Reply Append Path

Do not route agent replies through draft UI state.

Recommended requirement:

- add a programmatic append helper in `CommentMutationController`
- that helper appends one child entry and persists through the existing note-write path

`CommentAgentController` should use that helper so note writes continue to be owned by SideNote2.

## Sidebar Spec

## Index Mode State

Extend index sidebar mode state in:

- `src/ui/views/viewState.ts`

Required change:

```ts
export type IndexSidebarMode = "list" | "thought-trail" | "agent";
```

Persist `agent` in `CustomViewState` the same way current index modes are persisted.

## Agent Tab Placement

Add `Agent` as the third top-level tab in:

- `src/ui/views/SideNote2View.ts`

Tab order:

- `List`
- `Thought Trail`
- `Agent`

This applies only to the index sidebar.
Do not add a separate agent mode to source-note sidebars in phase 1.

## Agent Membership

Add a derived planner, recommended file:

- `src/ui/views/agentSidebarPlanner.ts`

The base universe for `Agent` mode is:

1. the same resolved-mode comment universe used by `List`
2. narrowed by the same file filter root when active
3. narrowed to agent-relevant threads only

Minimum inclusion rule:

- thread has at least one run record
- or thread has at least one `outputEntryId` from an agent run

Do not infer agent relevance from raw rendered reply text.
Use run records as the durable source for agent involvement.

## Agent Sorting

Recommended sort order for `Agent` mode:

1. running
2. queued
3. failed
4. succeeded
5. most recent `endedAt` or `createdAt`

## Agent Status Rendering

Extend the sidebar card presentation so agent-relevant threads can show:

- queued
- running
- failed
- succeeded

At minimum, these statuses must be visible in the `Agent` tab.
If reused in `List`, the status model must stay identical.

## Agent Thread Actions

Phase 1 thread-level actions in the `Agent` tab should include:

- open thread
- edit normal entries
- append normal entries
- retry latest run when valid

Do not add a separate active-runs panel.

## Module Ownership

### `src/core/text/agentDirectives.ts`

Owns:

- parsing `@codex` and `@claude`
- conflict detection
- explicit-target resolution

### `src/core/agents/agentRuns.ts`

Owns:

- run status types
- run record shape
- helper selectors such as latest-run-by-thread

### `src/control/agentRunStore.ts`

Owns:

- reading persisted `agentRuns`
- normalizing legacy or malformed stored payloads
- writing updated run arrays back into plugin data

### `src/control/commentAgentController.ts`

Owns:

- post-persist directive handling
- queue management
- runtime invocation
- run-state transitions
- retry creation
- raw reply append orchestration

### `src/control/commentMutationController.ts`

Owns:

- calling the agent controller after successful `new` and `append` saves
- never auto-dispatching after `edit`
- exposing a programmatic append helper for agent replies

### `src/ui/views/SideNote2View.ts`

Owns:

- rendering the `Agent` tab
- wiring shared toolbar controls
- routing retry clicks to plugin/controller entry points

### `src/ui/views/sidebarPersistedComment.ts`

Owns:

- displaying run status cues
- rendering retry action affordances
- keeping parent and child card layouts consistent

## Logging

Add agent-specific log events under area `agents`.

Minimum events:

- `agents.directive.detected`
- `agents.directive.conflict`
- `agents.run.queued`
- `agents.run.started`
- `agents.run.succeeded`
- `agents.run.failed`
- `agents.reply.appended`
- `agents.retry.created`

Payloads must continue following the existing logging hygiene rules:

- no raw reply text
- no note body
- no selected text
- no absolute paths

## Tests

Add or extend tests for:

- directive parsing and email avoidance
- conflicting-target detection
- run-store normalization
- post-persist trigger behavior in `CommentMutationController`
- edit-save no-dispatch behavior
- retry creating a new run record
- unsupported environment failure when vault root is unavailable
- agent reply append behavior
- `IndexSidebarMode = "agent"` persistence
- agent-tab membership under file filter and resolved mode
- agent-tab sorting by status and recency

## Implementation Notes

- The current `preferredAgentTarget` setting already exists in code. This spec does not require it to drive explicit mention dispatch.
- The current PRD `Open Questions` section can remain as historical context, but implementation should follow the closed decisions in this spec.
