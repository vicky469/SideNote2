export const LOG_RETENTION_DAYS = 3;

function padDatePart(value: number): string {
    return String(value).padStart(2, "0");
}

export function formatLocalLogDate(date: Date): string {
    return [
        String(date.getFullYear()),
        padDatePart(date.getMonth() + 1),
        padDatePart(date.getDate()),
    ].join("-");
}

export function getDailyLogFileName(date: Date): string {
    return `${formatLocalLogDate(date)}.jsonl`;
}

export function parseDailyLogFileName(filePath: string): Date | null {
    const fileName = filePath.split("/").pop() ?? filePath;
    const match = /^(\d{4})-(\d{2})-(\d{2})\.jsonl$/.exec(fileName);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function listExpiredLogFiles(
    filePaths: readonly string[],
    now: Date,
    retentionDays = LOG_RETENTION_DAYS,
): string[] {
    const today = startOfLocalDay(now).getTime();
    const retentionWindowMs = retentionDays * 24 * 60 * 60 * 1000;

    return filePaths.filter((filePath) => {
        const parsedDate = parseDailyLogFileName(filePath);
        if (!parsedDate) {
            return false;
        }

        const ageMs = today - startOfLocalDay(parsedDate).getTime();
        return ageMs >= retentionWindowMs;
    });
}
