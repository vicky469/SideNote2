# SideNote2 Refactor Retrospective

This note explains the **order**, **rationale**, and **refactoring principles** behind the codebase refactor.

It is intentionally not just “we changed folders to match the diagram.” The diagram came later as a way to explain a structure that was already being carved out of the code.

## Scope

This retrospective starts at the point where the work changed from documentation cleanup into actual code refactoring.

It does **not** focus on:

- Mermaid vs Canvas diagram experiments
- README badge/document formatting work
- one-off bug fixes unless they directly shaped the refactor

It does focus on:

- why the refactor order was chosen
- what each step extracted
- which files were affected
- what design and refactoring skills were being applied

## Starting Point

The codebase had a few clear structural problems:

- `src/main.ts` was a very large mixed-responsibility file. During the refactor it started around **2207 lines**.
- `src/ui/views/SideNote2View.ts` also carried too many jobs. It started around **1014 lines**.
- `src/core/*` was a useful bucket, but it mixed unrelated concerns: anchors, storage, derived views, file rules, and text parsing.
- A lot of logic was testable in principle, but was trapped inside Obsidian-facing files.
- The plugin already had useful behavior, so the refactor had to be incremental and low-risk.
- The deeper issue was not just size. The same file often contained four different kinds of code at once:
  - framework bootstrapping
  - behavior orchestration
  - transient UI/session state
  - low-level helper policy

That combination suggests a specific strategy:

1. **Do not rewrite.**
2. **Extract one seam at a time.**
3. **Prefer behavior-preserving moves over redesign-first moves.**
4. **Make the composition root thin.**
5. **Move pure logic toward planners/helpers, side effects toward controllers, and volatile UI state toward stores.**

## Why This Order

The order was driven by **risk and dependency**, not by aesthetics.

When choosing the next seam, the main questions were:

1. **How much responsibility density is in this cluster?**
   - If one area mixed unrelated reasons to change, it moved up the queue.
2. **Is it on the read path or the write path?**
   - Read-only or derived flows were safer to extract before canonical write flows.
3. **Can it be given a narrow host interface?**
   - If a behavior could depend on 5-10 callbacks instead of the whole plugin object, it was a good extraction candidate.
4. **Does it own persistent state, transient state, or derived state?**
   - Those are different categories and should not be hidden in the same file.
5. **Will this extraction unlock later ones?**
   - Some moves were not the biggest mess, but they created a landing zone for the next 2-3 steps.
6. **Will the result be more testable, or just more fragmented?**
   - If a split only created indirection, it was postponed.

That produced a dependency ladder:

1. Give the repo better semantic buckets.
2. Extract coherent orchestration clusters out of `main.ts`.
3. Pull volatile session state into explicit stores.
4. Turn `main.ts` into a real composition root.
5. Refactor `SideNote2View.ts` only after the backend/control seams were stable.

### 1. Start with naming and packaging

Before extracting lots of behavior, it helps to give the codebase better semantic buckets. That reduces mental load and gives later extractions a place to land.

### 2. Thin `main.ts` before touching the sidebar heavily

`main.ts` was the highest-responsibility file and the best place to carve stable seams:

- entry
- navigation
- persistence
- workspace context
- lifecycle
- registration

If those stay mixed together, the UI refactor has no stable backend boundary to lean on.

### 3. Separate “what should happen” from “talk to Obsidian”

This is why several areas got a **planner/controller** split:

- planners hold pure decisions
- controllers hold side effects and integration code

That pattern made it possible to increase test coverage without needing the full Obsidian runtime.

### 4. Extract state stores before UI session glue

Draft state and revealed-comment state were not just “data.” They were transient UI session state. Pulling them into stores made later controller extractions cleaner and prevented `main.ts` from remaining the hidden owner of every volatile flag.

### 5. Refactor the sidebar after the app shell was stable

The sidebar had the most DOM/event complexity. If it were refactored too early, every change would still be coupled to unstable plugin-shell logic. It was safer to refactor the UI after the application/control layer had become clearer.

### 6. Stop when the remaining code is cohesive

A refactor is done when the remaining files have clear responsibility, not when every file is “small.” Some glue is legitimate glue.

## Refactoring Vocabulary Used

These patterns show up repeatedly in the sequence below:

- **Composition root**: the top-level file that wires everything together. Here, `src/main.ts`.
- **Controller**: imperative orchestration around a behavior cluster.
- **Planner**: pure or mostly-pure decision logic extracted from a controller.
- **Store**: small object that owns ephemeral mutable state.
- **Seam carving**: extracting along a boundary that already exists in behavior, rather than inventing a new abstraction.
- **Strangler-fig refactor**: keep behavior running while moving one concern at a time out of the old file.
- **Node-safe boundary**: keep testable logic free of hard runtime imports from `obsidian` when possible.

## Chronological Refactor Log

### 0. Re-bucket `src/core/*`

Primary files:

- `src/core/anchorResolver.ts` -> `src/core/anchors/anchorResolver.ts`
- `src/core/commentAnchors.ts` -> `src/core/anchors/commentAnchors.ts`
- `src/core/appConfig.ts` -> `src/core/config/appConfig.ts`
- `src/core/allCommentsNote.ts` -> `src/core/derived/allCommentsNote.ts`
- `src/core/editorHighlightRanges.ts` -> `src/core/derived/editorHighlightRanges.ts`
- `src/core/commentSyncPolicy.ts` -> `src/core/rules/commentSyncPolicy.ts`
- `src/core/commentableFiles.ts` -> `src/core/rules/commentableFiles.ts`
- `src/core/attachmentCommentStorage.ts` -> `src/core/storage/attachmentCommentStorage.ts`
- `src/core/noteCommentStorage.ts` -> `src/core/storage/noteCommentStorage.ts`
- `src/core/commentMentions.ts` -> `src/core/text/commentMentions.ts`
- `src/core/commentTags.ts` -> `src/core/text/commentTags.ts`

What was being refactored:

- A generic “core” bucket into named subdomains.

Why this came first:

- Later extractions needed a stable destination.
- It reduced mental friction before moving logic out of `main.ts`.

Principles used:

- semantic packaging
- naming as architecture
- reduce accidental coupling by folder structure

### 1. Extract comment entry flow

Primary files:

- `src/control/commentEntryController.ts`
- `tests/commentEntryController.test.ts`
- `src/main.ts`

What was being refactored:

- “Add comment to selection” and page-note draft entry paths.

Why this step came early:

- It was a clear user-intent seam.
- It had limited dependencies.
- It created a template for later controller extractions.

Principles used:

- carve by user intent
- command orchestration extraction
- create a narrow host interface instead of passing the whole plugin

### 2. Extract highlight and preview decoration flow

Primary files:

- `src/control/commentHighlightController.ts`
- `src/control/commentHighlightPlanner.ts`
- `tests/commentHighlightController.test.ts`
- `src/main.ts`

What was being refactored:

- CodeMirror decorations
- preview highlights
- live preview managed blocks
- aggregate-note preview link handling

Why it came next:

- It was a large, self-contained subsystem.
- It was mostly read-only/derived behavior rather than persistence.
- It had a natural split between planning highlight ranges/wraps and talking to CodeMirror/preview DOM.

Principles used:

- separate rendering logic from composition root
- planner/controller split
- isolate UI projection from source-of-truth mutation

### 3. Extract navigation and reveal behavior

Primary files:

- `src/control/commentNavigationController.ts`
- `src/control/commentNavigationPlanner.ts`
- `tests/sidebarIndexContext.test.ts`
- `tests/sidebarLeafActivation.test.ts`
- `src/main.ts`

What was being refactored:

- sidebar activation
- comment reveal/open flow
- preferred file leaf selection

Why it came before persistence:

- reveal/open behavior was independent enough to isolate early
- it reduced a major cluster of workspace branching in `main.ts`

Principles used:

- separate navigation policy from execution
- preserve UX semantics while reducing leaf-selection duplication

### 4. Extract workspace context and active file policy

Primary files:

- `src/control/workspaceContextController.ts`
- `src/control/workspaceContextPlanner.ts`
- `tests/sidebarIndexContext.test.ts`
- `tests/sidebarLeafActivation.test.ts`
- `src/main.ts`

What was being refactored:

- file-open handling
- active-leaf-change handling
- active markdown/sidebar file tracking
- index-note mode sync

Why it came after navigation:

- navigation and workspace context touch the same Obsidian concepts
- extracting them in sequence reduced back-and-forth between overlapping responsibilities

Principles used:

- state synchronization boundaries
- explicit ownership of workspace-derived state

### 5. Extract persistence and refresh scheduling

Primary files:

- `src/control/commentPersistenceController.ts`
- `src/control/commentPersistencePlanner.ts`
- `src/main.ts`

What was being refactored:

- note-backed write flow
- load-from-note flow
- modify handling
- deferred aggregate refresh scheduling
- coordination with derived metadata and index refresh

Why it came here:

- persistence was high-risk and depended on stable workspace/view seams
- extracting it too early would have made the dependency graph messier
- the canonical note-backed storage path needed one concentrated owner before mutation code could become clean

Principles used:

- centralize writes to the canonical source of truth
- isolate async side-effect policy
- make refresh semantics explicit

### 6. Extract comment mutation flow

Primary files:

- `src/control/commentMutationController.ts`
- `tests/commentMutationController.test.ts`
- `src/main.ts`

What was being refactored:

- save draft
- add/edit/delete/resolve/unresolve comment behavior
- duplicate-add suppression

Why it came after persistence:

- mutation is orchestration around `commentManager + persistence`
- once persistence existed as a seam, mutation could become a focused controller instead of a mixed blob

Principles used:

- single mutation path
- reduce write-path duplication
- transactional thinking around side effects

### 7. Extract derived metadata augmentation

Primary files:

- `src/core/derived/derivedCommentMetadata.ts`
- `src/core/derived/derivedCommentMetadataPlanner.ts`
- `tests/derivedCommentMetadata.test.ts`
- `src/main.ts`

What was being refactored:

- metadata cache augmentation
- derived wiki-link projection
- rename/delete/persistence hooks

Why it came after persistence/mutation:

- this logic depends on comment writes and file changes
- it is derived state, not primary state, so it is safer to refactor after the primary write path is stable
- it also touches Obsidian metadata augmentation, which is a framework edge case and better isolated after the core write path is known-good

Principles used:

- isolate framework augmentation
- keep derived state secondary to canonical data

### 8. Extract draft session state

Primary files:

- `src/domain/DraftSessionStore.ts`
- `tests/draftSessionStore.test.ts`
- `src/main.ts`

What was being refactored:

- current draft
- host file path
- saving draft comment id

Why here:

- once mutation logic moved out, the remaining draft fields in `main.ts` were clearly just session state

Principles used:

- explicit ephemeral state
- separate session state from orchestration code

### 9. Extract revealed comment selection state

Primary files:

- `src/domain/RevealedCommentSelectionStore.ts`
- `tests/revealedCommentSelectionStore.test.ts`
- `src/main.ts`

What was being refactored:

- active revealed comment id per file

Why right after draft state:

- same category of problem: volatile UI/session state hidden inside the plugin shell

Principles used:

- small focused stores
- state locality

### 10. Extract index note settings logic

Primary files:

- `src/control/indexNoteSettingsController.ts`
- `src/control/indexNoteSettingsPlanner.ts`
- `tests/indexNoteSettingsController.test.ts`
- `src/main.ts`

What was being refactored:

- settings load/save
- index note path changes
- path normalization
- header image settings
- draft/sidebar retargeting after index note changes

Why this came after stores:

- settings changes affected draft host path and sidebar target state
- those needed clean owners first

Principles used:

- normalize at system boundaries
- isolate configuration side effects

### 11. Extract workspace view helpers

Primary files:

- `src/control/workspaceViewController.ts`
- `tests/workspaceViewController.test.ts`
- `src/main.ts`

What was being refactored:

- file lookup
- markdown view lookup
- current note content reads
- preview rerendering
- sidebar rerendering
- markdown selection clearing

Why here:

- many controllers were still receiving tiny duplicated view helper closures from `main.ts`
- consolidating them simplified later extractions
- repeated helpers such as “find file/view/content and rerender” were a signal that an adapter object was already present implicitly

Principles used:

- gateway pattern
- framework adapter extraction

### 12. Extract lifecycle routing

Primary files:

- `src/control/pluginLifecycleController.ts`
- `tests/pluginLifecycleController.test.ts`
- `src/main.ts`

What was being refactored:

- `onLayoutReady`
- vault rename/delete/modify handlers
- debounced editor-change refresh

Why late in the `main.ts` pass:

- once the business logic had destinations, lifecycle code became simple routing

Principles used:

- composition root should register handlers, not implement them
- event routing over event logic

### 13. Extract registration wiring

Primary files:

- `src/control/pluginRegistrationController.ts`
- `tests/pluginRegistrationController.test.ts`
- `src/main.ts`

What was being refactored:

- view registration
- protocol handler registration
- command wiring
- editor-menu wiring
- ribbon setup

Why after lifecycle:

- same family of code: bootstrapping and framework wiring

Principles used:

- declarative registration
- thin shell, thick behavior modules

### 14. Extract session/UI glue

Primary files:

- `src/control/commentSessionController.ts`
- `tests/commentSessionController.test.ts`
- `src/main.ts`

What was being refactored:

- draft session refresh policy
- revealed-comment refresh policy
- resolved-comment visibility toggle

Why this was not extracted earlier:

- it depended on both stores and view-refresh seams already existing

Principles used:

- co-locate state transitions with required refresh side effects
- remove “hidden UI policy” from the plugin shell

### 15. Refactor `main.ts` into a real composition root

Primary files:

- `src/main.ts`

What was being refactored:

- not one extraction, but the cumulative result of steps 1-14

Why this matters:

- the point was not “smaller file good”
- the point was “`main.ts` should wire, not think”

Result:

- `src/main.ts` ended at about **583 lines**
- its job became composition, lifecycle registration, and public plugin surface

Principles used:

- composition root
- strangler-fig refactor
- remove responsibility density

### 16. Extract sidebar draft-editor behavior

Primary files:

- `src/ui/views/sidebarDraftEditor.ts`
- `tests/sidebarDraftEditor.test.ts`
- `src/ui/views/SideNote2View.ts`

What was being refactored:

- draft list merge/sort helper
- textarea row sizing
- Enter-to-save logic
- link/tag suggest behavior

Why this was the first UI extraction:

- it was the densest and most volatile sidebar cluster
- it was specific enough to extract cleanly
- it could be made Node-safe through host callbacks
- it also had the highest edit churn: textarea sizing, key handling, suggest flows, and draft ordering tend to change together

Principles used:

- extract volatile interaction logic first
- host-callback inversion
- keep testable code free of direct Obsidian runtime imports

### 17. Extract persisted comment cards

Primary files:

- `src/ui/views/sidebarPersistedComment.ts`
- `tests/sidebarPersistedComment.test.ts`
- `src/ui/views/SideNote2View.ts`

What was being refactored:

- persisted card presentation
- markdown content rendering wiring
- click-to-open behavior
- internal link interception
- resolve/edit/delete buttons

Why this followed the draft-editor split:

- it mirrored the next biggest card-local behavior cluster
- once draft behavior was separated, persisted-card behavior became much easier to isolate

Principles used:

- render one card type in one place
- event locality
- presentation model extraction

### 18. Extract draft comment cards

Primary files:

- `src/ui/views/sidebarDraftComment.ts`
- `tests/sidebarDraftComment.test.ts`
- `src/ui/views/SideNote2View.ts`

What was being refactored:

- draft card shell
- textarea/action row setup
- save/cancel button wiring

Why this was separate from `sidebarDraftEditor.ts`:

- `sidebarDraftEditor.ts` owns editing behavior
- `sidebarDraftComment.ts` owns the draft card as a rendered unit

That separation is subtle but important:

- one file answers “how does draft editing behave?”
- the other answers “how is a draft card rendered and wired?”

Principles used:

- split markup shell from editing engine
- symmetry with persisted-card extraction

### 19. Extract sidebar interaction state and shell behavior

Primary files:

- `src/ui/views/sidebarInteractionController.ts`
- `tests/sidebarInteractionController.test.ts`
- `src/ui/views/SideNote2View.ts`

What was being refactored:

- active comment state
- draft focus scheduling
- copy/selection ownership
- background click behavior
- draft-dismiss behavior
- internal link focus handoff
- open-comment active-state handling

Why this came last:

- it was the most cross-cutting UI behavior
- it touched container DOM, document events, focus, render timing, and reveal flow
- extracting it earlier would have created too much moving target instability

Principles used:

- extract shell-state last
- protect UX behavior while moving code
- centralize cross-cutting interaction semantics

### 20. Stop refactoring when the remaining code became cohesive

Primary files:

- `src/ui/views/SideNote2View.ts`

What remained:

- view lifecycle
- render cycle orchestration
- toolbar/section shell rendering
- bridging helper modules together
- delete confirmation modal wiring

Why this is a good stopping point:

- those responsibilities are actually related
- splitting them further would mostly create indirection, not clarity

Result:

- `src/ui/views/SideNote2View.ts` ended at about **389 lines**

Principles used:

- stop at cohesion
- do not refactor for symmetry alone

## Why These Steps Formed a Chain

The sequence was not arbitrary. Each step deliberately reduced one kind of ambiguity so the next step became obvious.

- **Re-bucketing `src/core/*`** gave later extractions a semantic destination. Without that, every move would have had a second argument about folder placement.
- **Entry, highlight, navigation, and workspace extraction** reduced `main.ts` from “everything shell” into identifiable orchestration lanes.
- **Persistence before mutation** prevented multiple write paths from surviving in parallel. That matters because write bugs are harder to notice and harder to repair.
- **Stores before session controller** separated state ownership from refresh policy. Only after that could session logic become a coherent controller.
- **Workspace view helper extraction** turned many repeated micro-dependencies into one adapter, which made later lifecycle and registration extraction simpler.
- **Lifecycle and registration late** was intentional. Those areas should route to stable modules, not be extracted while the destinations are still moving.
- **Sidebar refactor last** worked because the plugin shell had stopped shifting underneath it. At that point `SideNote2View.ts` could be thinned without constantly reopening backend decisions.

## Skills and Principles Used Repeatedly

### Structural triage

Before extracting anything, the code was being classified into four buckets:

- canonical state
- derived state
- transient session state
- framework shell

That classification is what made the order defensible. It is also why the refactor did not turn into random helper extraction.

### Responsibility-density analysis

The first question was not “what folder should this file be in?” It was:

- How many unrelated reasons does this file have to change?

That is the fastest way to spot where a refactor should begin.

### Refactor by behavior cluster, not by type

A bad refactor would have been:

- “extract helpers”
- “extract utils”
- “make more folders”

The actual refactor used behavior clusters:

- entry
- navigation
- persistence
- session
- interaction
- draft editing
- persisted card rendering

That is why the result is easier to reason about.

### Planner vs controller split

This pattern was used whenever a cluster had:

- a pure decision part
- an imperative side-effect part

That separation improved testability and made the code easier to read under pressure.

### State ownership extraction

When a large file contains many flags, ids, and “current X” variables, that usually means orchestration and state ownership have collapsed together.

The fix is not always “make a state library.” In this refactor the better move was:

- put small volatile state into stores
- keep refresh and side-effect policy in controllers

That is why `DraftSessionStore` and `RevealedCommentSelectionStore` were extracted before the session controller was finalized.

### Host interfaces instead of plugin leakage

Many extracted modules were given narrow host contracts instead of direct access to the whole plugin object.

Why:

- easier testing
- less accidental coupling
- clearer dependency surface

### Keep Obsidian runtime at the edge when possible

The Node test environment cannot freely import every runtime-backed Obsidian module. The refactor intentionally used:

- planners
- stores
- host callbacks

to keep logic testable without a live app process.

### Verify after each step

The refactor was done as a sequence of small moves with repeated:

- `npm test`
- `npm run build`

This matters because incremental refactoring is less about courage and more about feedback frequency.

## What This Refactor Was Not

It was not:

- a full architecture rewrite
- a conversion to a framework
- an attempt to make every file tiny
- a cosmetic directory reshuffle

It was a controlled reduction of responsibility density while preserving behavior.

## What Stayed Central on Purpose

Some things were intentionally **not** decomposed further.

- `src/commentManager.ts` stayed central because it is the in-memory owner of comment CRUD, lookup, and per-file grouping. Splitting that prematurely would risk creating multiple partial sources of truth.
- `src/main.ts` still exists as the plugin shell because Obsidian plugins naturally need one object that registers commands, views, events, settings, and lifecycle hooks.
- `src/ui/views/SideNote2View.ts` still owns the render shell because view lifecycle and section composition are genuinely related responsibilities once card rendering and interaction policy are split out.

That is an important refactoring skill by itself: **do not extract the last coherent center just to make the file graph look more uniform.**

## End State

The codebase now has a much clearer shape:

- `src/main.ts` is the plugin composition root.
- `src/control/*` contains application orchestration.
- `src/domain/*` contains volatile session state objects.
- `src/core/*` contains durable rules and storage logic.
- `src/ui/views/*` is no longer one giant mixed file; it is a small shell plus focused sidebar helpers.

The most important architectural gain is not “more files.” It is this:

- the canonical note-backed data path is clearer
- transient UI state has explicit owners
- side effects have concentrated homes
- pure logic has more test seams

That is why the refactor order looked the way it did.

At the end of the refactor pass:

- `src/main.ts` was down to **583 lines**
- `src/ui/views/SideNote2View.ts` was down to **389 lines**
- the test suite passed at **176/176**
- `npm run build` passed
