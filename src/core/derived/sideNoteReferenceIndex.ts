import type { AggregateCommentIndex } from "../../index/AggregateCommentIndex";
import { extractSideNoteReferences } from "../text/commentReferences";

export interface SideNoteReferenceRecord {
    label: string;
    sourceCommentId: string;
    sourceFilePath: string;
    sourceThreadId: string;
    sourceTimestamp: number;
    targetCommentId: string;
    targetFilePath: string | null;
    targetHintFilePath: string | null;
    targetThreadId: string | null;
    url: string;
}

export interface SideNoteReferenceIndex {
    incomingByThreadId: Map<string, SideNoteReferenceRecord[]>;
    outgoingByThreadId: Map<string, SideNoteReferenceRecord[]>;
    crossFileOutgoingAdjacency: Map<string, Set<string>>;
    references: SideNoteReferenceRecord[];
}

function normalizeNotePath(filePath: string): string {
    const parts = filePath.replace(/\\/g, "/").split("/");
    const normalizedParts: string[] = [];

    for (const part of parts) {
        if (!part || part === ".") {
            continue;
        }

        if (part === "..") {
            normalizedParts.pop();
            continue;
        }

        normalizedParts.push(part);
    }

    return normalizedParts.join("/");
}

function isAllCommentsNotePath(filePath: string, currentPath: string): boolean {
    const normalizedPath = normalizeNotePath(filePath);
    const normalizedCurrentPath = normalizeNotePath(currentPath);
    return normalizedPath === normalizedCurrentPath || normalizedPath === "SideNote2 comments.md";
}

function appendGroupedRecord(
    grouped: Map<string, SideNoteReferenceRecord[]>,
    key: string,
    record: SideNoteReferenceRecord,
): void {
    const existing = grouped.get(key);
    if (existing) {
        existing.push(record);
        return;
    }

    grouped.set(key, [record]);
}

function sortGroupedRecords(grouped: Map<string, SideNoteReferenceRecord[]>): void {
    for (const records of grouped.values()) {
        records.sort((left, right) => {
            if (left.sourceTimestamp !== right.sourceTimestamp) {
                return right.sourceTimestamp - left.sourceTimestamp;
            }

            if (left.sourceFilePath !== right.sourceFilePath) {
                return left.sourceFilePath.localeCompare(right.sourceFilePath);
            }

            return left.sourceCommentId.localeCompare(right.sourceCommentId);
        });
    }
}

export function buildSideNoteReferenceIndex(
    aggregateCommentIndex: Pick<AggregateCommentIndex, "getAllThreads" | "getThreadById">,
    options: {
        allCommentsNotePath: string;
        localVaultName?: string | null;
    },
): SideNoteReferenceIndex {
    const references: SideNoteReferenceRecord[] = [];
    const outgoingByThreadId = new Map<string, SideNoteReferenceRecord[]>();
    const incomingByThreadId = new Map<string, SideNoteReferenceRecord[]>();
    const crossFileOutgoingAdjacency = new Map<string, Set<string>>();
    const threads = aggregateCommentIndex.getAllThreads();

    for (const thread of threads) {
        if (isAllCommentsNotePath(thread.filePath, options.allCommentsNotePath)) {
            continue;
        }

        for (const entry of thread.entries) {
            const seenTargets = new Set<string>();
            const extractedReferences = extractSideNoteReferences(entry.body ?? "", {
                localOnly: true,
                localVaultName: options.localVaultName ?? null,
            });

            for (const reference of extractedReferences) {
                const targetThread = aggregateCommentIndex.getThreadById(reference.target.commentId);
                const targetThreadId = targetThread?.id ?? null;
                const targetFilePath = targetThread?.filePath ?? null;
                const dedupeKey = `${targetThreadId ?? reference.target.commentId}|${targetFilePath ?? reference.target.filePath ?? ""}`;
                if (seenTargets.has(dedupeKey)) {
                    continue;
                }

                seenTargets.add(dedupeKey);
                const record: SideNoteReferenceRecord = {
                    label: reference.label,
                    sourceCommentId: entry.id,
                    sourceFilePath: thread.filePath,
                    sourceThreadId: thread.id,
                    sourceTimestamp: entry.timestamp,
                    targetCommentId: reference.target.commentId,
                    targetFilePath,
                    targetHintFilePath: reference.target.filePath,
                    targetThreadId,
                    url: reference.url,
                };
                references.push(record);
                appendGroupedRecord(outgoingByThreadId, thread.id, record);

                if (targetThreadId) {
                    appendGroupedRecord(incomingByThreadId, targetThreadId, record);
                }

                if (
                    targetFilePath
                    && normalizeNotePath(targetFilePath) !== normalizeNotePath(thread.filePath)
                    && !isAllCommentsNotePath(targetFilePath, options.allCommentsNotePath)
                ) {
                    const neighbors = crossFileOutgoingAdjacency.get(thread.filePath) ?? new Set<string>();
                    neighbors.add(targetFilePath);
                    crossFileOutgoingAdjacency.set(thread.filePath, neighbors);
                }
            }
        }
    }

    sortGroupedRecords(outgoingByThreadId);
    sortGroupedRecords(incomingByThreadId);
    references.sort((left, right) => {
        if (left.sourceTimestamp !== right.sourceTimestamp) {
            return right.sourceTimestamp - left.sourceTimestamp;
        }

        return left.sourceCommentId.localeCompare(right.sourceCommentId);
    });

    return {
        incomingByThreadId,
        outgoingByThreadId,
        crossFileOutgoingAdjacency,
        references,
    };
}
