# TODO: Remove Temporary Legacy Note-Comment Auto-Migration

Context:
- SideNote2 `2.0.1` auto-migrates older flat note comments to threaded `entries[]` storage on startup.
- This is a temporary compatibility bridge for users upgrading into the threaded storage model.

Target window:
- Prefer removal in `2.1.0` if the upgrade window is clearly over.
- Otherwise remove no later than `3.0.0`.

Cleanup scope:
- remove `src/control/legacyNoteCommentsMigrationController.ts`
- remove the startup wiring from `src/main.ts`
- remove the legacy migration marker stored in plugin data
- remove the shared legacy migration planner from `src/core/storage/noteCommentStorage.ts` if nothing else still uses it
- remove the maintenance-only `comment:migrate-legacy` CLI and script wrappers if they are no longer needed
- remove temporary legacy migration tests
- remove temporary legacy migration references from README, dev docs, and skills

Exit criteria:
- supported vaults have had enough time to upgrade past the flat note-comment format
- release notes clearly announce that legacy flat note comments are no longer auto-migrated
