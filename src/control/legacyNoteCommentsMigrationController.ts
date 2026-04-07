import { MarkdownView, TFile, type Plugin } from "obsidian";
import {
    buildLegacyNoteCommentMigrationPlan,
    type LegacyNoteCommentMigrationPlan,
} from "../core/storage/noteCommentStorage";
import type { SideNote2Settings } from "../ui/settings/SideNote2SettingTab";

// Temporary one-time upgrade bridge for 2.0.1. Remove after the legacy flat
// note-comment format is no longer expected in user vaults.
export const LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION = "2.0.1";

type MigrationApplyResult =
    | { kind: "migrated" }
    | { kind: "already-threaded" }
    | { kind: "unsupported" }
    | { kind: "changed-during-migration" };

export interface LegacyNoteCommentsMigrationHost {
    app: Plugin["app"];
    getSettings(): SideNote2Settings;
    setSettings(settings: SideNote2Settings): void;
    saveSettings(): Promise<void>;
    getAllCommentsNotePath(): string;
    getCurrentNoteContent(file: TFile): Promise<string>;
    getMarkdownViewForFile(file: TFile): MarkdownView | null;
    loadVisibleFiles(): Promise<void>;
    refreshCommentViews(): Promise<void>;
    refreshEditorDecorations(): void;
    refreshAggregateNoteNow(): Promise<void>;
    showNotice(message: string): void;
    warn(message: string, error: unknown): void;
}

function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export class LegacyNoteCommentsMigrationController {
    private migrationPromise: Promise<void> | null = null;

    constructor(private readonly host: LegacyNoteCommentsMigrationHost) {}

    public async runStartupMigrationIfNeeded(): Promise<void> {
        if (this.host.getSettings().lastMigratedNoteCommentStorageVersion === LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION) {
            return;
        }

        if (this.migrationPromise) {
            await this.migrationPromise;
            return;
        }

        this.migrationPromise = this.runStartupMigration();
        try {
            await this.migrationPromise;
        } finally {
            this.migrationPromise = null;
        }
    }

    private async runStartupMigration(): Promise<void> {
        const markdownFiles = this.host.app.vault
            .getMarkdownFiles()
            .filter((file) => file.path !== this.host.getAllCommentsNotePath())
            .sort((left, right) => left.path.localeCompare(right.path));

        let migratedCount = 0;
        let unsupportedCount = 0;
        let changedDuringMigrationCount = 0;

        for (const file of markdownFiles) {
            try {
                const noteContent = await this.host.getCurrentNoteContent(file);
                const plan = buildLegacyNoteCommentMigrationPlan(noteContent, file.path);
                if (plan.kind === "no-managed-block" || plan.kind === "threaded") {
                    continue;
                }

                if (plan.kind === "unsupported") {
                    unsupportedCount += 1;
                    continue;
                }

                const result = await this.applyLegacyMigration(file);
                if (result.kind === "migrated") {
                    migratedCount += 1;
                    continue;
                }

                if (result.kind === "unsupported") {
                    unsupportedCount += 1;
                    continue;
                }

                if (result.kind === "changed-during-migration") {
                    changedDuringMigrationCount += 1;
                }
            } catch (error) {
                changedDuringMigrationCount += 1;
                this.host.warn(`Failed to auto-migrate legacy note comments in ${file.path}`, error);
            }
        }

        if (changedDuringMigrationCount === 0) {
            await this.persistCompletedStorageVersion();
        }

        if (migratedCount > 0) {
            await this.host.loadVisibleFiles();
            await this.host.refreshCommentViews();
            this.host.refreshEditorDecorations();
            await this.host.refreshAggregateNoteNow();
        }

        if (migratedCount > 0 || unsupportedCount > 0 || changedDuringMigrationCount > 0) {
            this.host.showNotice(this.buildSummaryNotice({
                migratedCount,
                unsupportedCount,
                changedDuringMigrationCount,
            }));
        }
    }

    private async persistCompletedStorageVersion(): Promise<void> {
        const settings = this.host.getSettings();
        if (settings.lastMigratedNoteCommentStorageVersion === LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION) {
            return;
        }

        this.host.setSettings({
            ...settings,
            lastMigratedNoteCommentStorageVersion: LEGACY_NOTE_COMMENTS_AUTO_MIGRATION_VERSION,
        });
        await this.host.saveSettings();
    }

    private async applyLegacyMigration(file: TFile): Promise<MigrationApplyResult> {
        const openView = this.host.getMarkdownViewForFile(file);
        if (openView) {
            return this.applyMigrationToOpenView(file, openView);
        }

        let result: MigrationApplyResult = { kind: "changed-during-migration" };
        await this.host.app.vault.process(file, (currentContent) => {
            const plan = buildLegacyNoteCommentMigrationPlan(currentContent, file.path);
            if (plan.kind === "legacy") {
                result = { kind: "migrated" };
                return plan.nextContent;
            }

            result = plan.kind === "threaded"
                ? { kind: "already-threaded" }
                : plan.kind === "unsupported"
                    ? { kind: "unsupported" }
                    : { kind: "changed-during-migration" };
            return currentContent;
        });
        return result;
    }

    private async applyMigrationToOpenView(file: TFile, openView: MarkdownView): Promise<MigrationApplyResult> {
        const plan = buildLegacyNoteCommentMigrationPlan(openView.editor.getValue(), file.path);
        if (plan.kind !== "legacy") {
            return this.mapNonLegacyPlanToResult(plan);
        }

        openView.editor.setValue(plan.nextContent);
        await openView.save();
        return { kind: "migrated" };
    }

    private mapNonLegacyPlanToResult(plan: Exclude<LegacyNoteCommentMigrationPlan, { kind: "legacy" }>): MigrationApplyResult {
        if (plan.kind === "threaded") {
            return { kind: "already-threaded" };
        }

        if (plan.kind === "unsupported") {
            return { kind: "unsupported" };
        }

        return { kind: "changed-during-migration" };
    }

    private buildSummaryNotice(summary: {
        migratedCount: number;
        unsupportedCount: number;
        changedDuringMigrationCount: number;
    }): string {
        const parts: string[] = [];
        if (summary.migratedCount > 0) {
            parts.push(`Migrated ${pluralize(summary.migratedCount, "legacy SideNote2 note comment")}`);
        }
        if (summary.unsupportedCount > 0) {
            parts.push(`${pluralize(summary.unsupportedCount, "note")} could not be auto-migrated and need manual inspection`);
        }
        if (summary.changedDuringMigrationCount > 0) {
            parts.push(`${pluralize(summary.changedDuringMigrationCount, "note")} changed during migration and will retry next launch`);
        }

        return parts.join(". ") + ".";
    }
}
