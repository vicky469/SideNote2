import type { DataAdapter } from "obsidian";
import { cloneCommentThreads, type CommentThread } from "../../commentManager";

const SIDECAR_STORAGE_VERSION = 1;

interface StoredSidecarComments {
    version: number;
    notePath: string;
    sourceId?: string;
    threads: CommentThread[];
}

export interface SidecarCommentStorageOptions {
    adapter: DataAdapter;
    pluginDirPath: string;
    hashText(text: string): Promise<string>;
}

function normalizeStoragePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function getParentPath(path: string): string {
    const normalized = normalizeStoragePath(path);
    const slashIndex = normalized.lastIndexOf("/");
    return slashIndex <= 0 ? "" : normalized.slice(0, slashIndex);
}

async function ensureDirectory(adapter: DataAdapter, targetPath: string): Promise<void> {
    const segments = normalizeStoragePath(targetPath).split("/").filter(Boolean);
    let nextPath = "";
    for (const segment of segments) {
        nextPath = nextPath ? `${nextPath}/${segment}` : segment;
        if (await adapter.exists(nextPath)) {
            continue;
        }

        await adapter.mkdir(nextPath);
    }
}

function createTempFileSuffix(): string {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) {
        return randomUuid;
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function cloneThreadsForNote(notePath: string, threads: unknown[]): CommentThread[] {
    return threads
        .filter((thread): thread is CommentThread => isRecord(thread))
        .map((thread) => ({
            ...thread,
            filePath: notePath,
            entries: Array.isArray(thread.entries)
                ? thread.entries.map((entry) => ({ ...entry }))
                : [],
        }));
}

export class SidecarCommentStorage {
    private readonly baseDirPath: string;
    private readonly sourceBaseDirPath: string;

    constructor(private readonly options: SidecarCommentStorageOptions) {
        this.baseDirPath = normalizeStoragePath(`${options.pluginDirPath}/sidenotes/by-note`);
        this.sourceBaseDirPath = normalizeStoragePath(`${options.pluginDirPath}/sidenotes/by-source`);
    }

    public getBaseDirPath(): string {
        return this.baseDirPath;
    }

    public getSourceBaseDirPath(): string {
        return this.sourceBaseDirPath;
    }

    public async exists(notePath: string): Promise<boolean> {
        return this.options.adapter.exists(await this.getNoteStoragePath(notePath));
    }

    public async read(notePath: string): Promise<CommentThread[] | null> {
        const storagePath = await this.getNoteStoragePath(notePath);
        return this.readStoragePath(storagePath, notePath);
    }

    public async existsForSource(sourceId: string): Promise<boolean> {
        return this.options.adapter.exists(await this.getSourceStoragePath(sourceId));
    }

    public async readForSource(sourceId: string, notePath: string): Promise<CommentThread[] | null> {
        return this.readStoragePath(await this.getSourceStoragePath(sourceId), notePath);
    }

    private async readStoragePath(storagePath: string, notePath: string): Promise<CommentThread[] | null> {
        if (!(await this.options.adapter.exists(storagePath))) {
            return null;
        }

        try {
            const rawContent = await this.options.adapter.read(storagePath);
            const parsed = JSON.parse(rawContent) as unknown;
            if (!isRecord(parsed) || parsed.version !== SIDECAR_STORAGE_VERSION || !Array.isArray(parsed.threads)) {
                return null;
            }

            return cloneThreadsForNote(notePath, parsed.threads);
        } catch {
            return null;
        }
    }

    public async write(notePath: string, threads: CommentThread[]): Promise<void> {
        const storagePath = await this.getNoteStoragePath(notePath);
        await this.writeStoragePath(storagePath, notePath, threads);
    }

    public async writeForSource(sourceId: string, notePath: string, threads: CommentThread[]): Promise<void> {
        const storagePath = await this.getSourceStoragePath(sourceId);
        await this.writeStoragePath(storagePath, notePath, threads, sourceId);
    }

    private async writeStoragePath(
        storagePath: string,
        notePath: string,
        threads: CommentThread[],
        sourceId?: string,
    ): Promise<void> {
        if (threads.length === 0) {
            if (await this.options.adapter.exists(storagePath)) {
                await this.options.adapter.remove(storagePath);
            }
            return;
        }

        const normalizedThreads = cloneCommentThreads(threads).map((thread) => ({
            ...thread,
            filePath: notePath,
        }));
        const payload: StoredSidecarComments = {
            version: SIDECAR_STORAGE_VERSION,
            notePath,
            ...(sourceId ? { sourceId } : {}),
            threads: normalizedThreads,
        };
        const serialized = `${JSON.stringify(payload)}\n`;
        const tempPath = `${storagePath}.tmp-${createTempFileSuffix()}`;

        await ensureDirectory(this.options.adapter, getParentPath(storagePath));
        await this.options.adapter.write(tempPath, serialized);
        try {
            if (await this.options.adapter.exists(storagePath)) {
                await this.options.adapter.remove(storagePath);
            }
            await this.options.adapter.rename(tempPath, storagePath);
        } catch (error) {
            if (await this.options.adapter.exists(tempPath)) {
                await this.options.adapter.remove(tempPath);
            }
            throw error;
        }
    }

    public async rename(previousNotePath: string, nextNotePath: string): Promise<void> {
        if (previousNotePath === nextNotePath) {
            return;
        }

        const previousStoragePath = await this.getNoteStoragePath(previousNotePath);
        if (!(await this.options.adapter.exists(previousStoragePath))) {
            return;
        }

        const threads = await this.read(previousNotePath);
        if (!threads || threads.length === 0) {
            await this.options.adapter.remove(previousStoragePath);
            return;
        }

        await this.write(nextNotePath, threads.map((thread) => ({
            ...thread,
            filePath: nextNotePath,
        })));

        const nextStoragePath = await this.getNoteStoragePath(nextNotePath);
        if (previousStoragePath !== nextStoragePath && await this.options.adapter.exists(previousStoragePath)) {
            await this.options.adapter.remove(previousStoragePath);
        }
    }

    public async remove(notePath: string): Promise<void> {
        const storagePath = await this.getNoteStoragePath(notePath);
        await this.removeStoragePath(storagePath);
    }

    public async removeForSource(sourceId: string): Promise<void> {
        await this.removeStoragePath(await this.getSourceStoragePath(sourceId));
    }

    private async removeStoragePath(storagePath: string): Promise<void> {
        if (!(await this.options.adapter.exists(storagePath))) {
            return;
        }

        await this.options.adapter.remove(storagePath);
    }

    public async getNoteStoragePath(notePath: string): Promise<string> {
        const noteHash = await this.options.hashText(notePath);
        const shard = noteHash.slice(0, 2) || "00";
        return normalizeStoragePath(`${this.baseDirPath}/${shard}/${noteHash}.json`);
    }

    public async getSourceStoragePath(sourceId: string): Promise<string> {
        const sourceHash = await this.options.hashText(sourceId);
        const shard = sourceHash.slice(0, 2) || "00";
        return normalizeStoragePath(`${this.sourceBaseDirPath}/${shard}/${sourceHash}.json`);
    }
}
