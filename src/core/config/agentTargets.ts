import { normalizeAnyAgentTarget } from "../agents/agentActorRegistry";

export type { SideNote2AgentTarget } from "../agents/agentActorDefinition";

export function normalizeAgentTarget(value: unknown) {
    return normalizeAnyAgentTarget(value);
}
