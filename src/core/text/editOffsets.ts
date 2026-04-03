import type { ManagedSectionEdit } from "../storage/noteCommentStorage";

interface RemapSelectionOffsetOptions {
    clampToManagedSectionStart?: boolean;
}

export function clampOffsetBeforeManagedSection(offset: number, managedSectionStartOffset: number): number {
    return offset >= managedSectionStartOffset
        ? managedSectionStartOffset
        : offset;
}

export function remapSelectionOffsetAfterManagedSectionEdit(
    offset: number,
    edit: ManagedSectionEdit,
    options: RemapSelectionOffsetOptions = {},
): number {
    let remappedOffset = offset;
    if (offset <= edit.fromOffset) {
        remappedOffset = offset;
    } else if (offset >= edit.toOffset) {
        remappedOffset = offset + edit.replacement.length - (edit.toOffset - edit.fromOffset);
    } else {
        remappedOffset = edit.fromOffset;
    }

    if (options.clampToManagedSectionStart) {
        return clampOffsetBeforeManagedSection(remappedOffset, edit.fromOffset);
    }

    return remappedOffset;
}
