export type IndexSidebarMode = "list" | "thought-trail";

export interface CustomViewState extends Record<string, unknown> {
    filePath: string | null;
    indexSidebarMode?: IndexSidebarMode;
    indexFileFilterPaths?: string[];
}
