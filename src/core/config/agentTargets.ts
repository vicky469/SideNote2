export type SideNote2AgentTarget = "codex" | "claude";

export const DEFAULT_PREFERRED_AGENT_TARGET: SideNote2AgentTarget = "codex";

export const SIDE_NOTE2_AGENT_TARGET_OPTIONS: Record<SideNote2AgentTarget, string> = {
    codex: "Codex",
    claude: "Claude",
};

export function normalizePreferredAgentTarget(value: unknown): SideNote2AgentTarget {
    if (typeof value !== "string") {
        return DEFAULT_PREFERRED_AGENT_TARGET;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "claude" ? "claude" : DEFAULT_PREFERRED_AGENT_TARGET;
}
