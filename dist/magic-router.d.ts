import { type AgentMode } from "./agent-mode.js";
export declare const MAGIC_ROUTER_STRATEGY = "magic-router";
export declare const ZAI_DEFAULT_PROVIDER = "zai-glm";
export declare const ZAI_DEFAULT_MODEL = "zai/glm-5.2";
export declare const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
export declare const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export declare const OPENROUTER_PROVIDER = "openrouter";
export declare const OPENROUTER_AUTO_MODEL = "openrouter/auto";
export declare const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
type EnvLike = Record<string, string | undefined>;
export type MagicRouterTaskType = "coding" | "solana_trading" | "prediction_market" | "wallet_ops" | "research" | "general";
export interface MagicRouterInferenceRoute {
    provider: string;
    model: string;
    credentialEnv: string;
    available: boolean;
    role: "selected" | "advisor" | "fallback";
    endpoint?: string;
    reason: string;
}
export interface MagicRouterRoute {
    strategy: typeof MAGIC_ROUTER_STRATEGY;
    mode: AgentMode;
    taskType: MagicRouterTaskType;
    inference: MagicRouterInferenceRoute;
    advisor?: MagicRouterInferenceRoute;
    fallbacks: MagicRouterInferenceRoute[];
    toolSet: string[];
    blockedTools: string[];
    guardrails: string[];
    dflow: {
        spotTradingDefault: boolean;
        predictionMarketDefault: boolean;
        credentialEnv: "DFLOW_API_KEY";
    };
}
export declare function classifyMagicRouterTask(input: string | string[] | undefined): MagicRouterTaskType;
export declare function resolveMagicRouter(input: string | string[] | undefined, env?: EnvLike, mode?: AgentMode): MagicRouterRoute;
export declare function describeMagicRouter(route: MagicRouterRoute): string;
export {};
//# sourceMappingURL=magic-router.d.ts.map