export type AgentMode = "ai" | "trading";
export declare const AGENT_MODES: readonly AgentMode[];
export declare const DEFAULT_AGENT_MODE: AgentMode;
/** Tool identifiers that touch wallets, signing, or on-chain trading. */
export declare const FINANCIAL_TOOLS: ReadonlySet<string>;
export declare function isAgentMode(value: unknown): value is AgentMode;
/** Remove financial tools from a tool set. Returns [allowed, blocked]. */
export declare function partitionToolsForMode(toolSet: readonly string[], mode: AgentMode): {
    allowed: string[];
    blocked: string[];
};
/**
 * Resolve the active agent mode: explicit env override, then persisted
 * state file, then the default (Trading Mode, preserving prior behavior).
 */
export declare function getAgentMode(env?: Record<string, string | undefined>): AgentMode;
export declare function setAgentMode(mode: AgentMode, env?: Record<string, string | undefined>): AgentMode;
export declare function describeAgentMode(mode: AgentMode): string;
//# sourceMappingURL=agent-mode.d.ts.map