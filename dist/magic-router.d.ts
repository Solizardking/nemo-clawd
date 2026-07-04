/**
 * 🪄 NEMOCLAWD MAGIC ROUTER
 *
 * The brain of the operation. Takes any natural-language task, classifies it,
 * assigns a confidence score, and routes it to the optimal inference model +
 * tool set. All in ~500 lines. Yes, it's that cool.
 *
 * Classification flow:
 *   Input → regex pattern match → confidence score → task type
 *   Task type → tool set mapping → guardrails → DFlow routing
 *   Inference → Ollama (default) → OpenRouter (advisor) → NVIDIA (fallback)
 */
export declare const MAGIC_ROUTER_STRATEGY = "magic-router";
export declare const MAGIC_ROUTER_VERSION = "2.0.0";
export declare const OLLAMA_DEFAULT_PROVIDER = "ollama-local";
export declare const OLLAMA_DEFAULT_MODEL = "hf.co/ordlibrary/hauhau-qwen36-onchain";
export declare const OPENROUTER_PROVIDER = "openrouter";
export declare const OPENROUTER_AUTO_MODEL = "openrouter/auto";
export declare const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export declare const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
export declare const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
type EnvLike = Record<string, string | undefined>;
export type MagicRouterTaskType = "coding" | "zk_proof" | "solana_trading" | "prediction_market" | "wallet_ops" | "research" | "image_gen" | "voice" | "data_analysis" | "security_audit" | "nft_ops" | "general";
export interface MagicRouterTaskMetadata {
    type: MagicRouterTaskType;
    label: string;
    emoji: string;
    description: string;
    confidence: number;
    requires_wallet: boolean;
    requires_api_key: boolean;
    typical_latency: "fast" | "medium" | "slow";
}
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
    version: typeof MAGIC_ROUTER_VERSION;
    taskType: MagicRouterTaskType;
    taskMeta: MagicRouterTaskMetadata;
    inference: MagicRouterInferenceRoute;
    advisor?: MagicRouterInferenceRoute;
    fallbacks: MagicRouterInferenceRoute[];
    toolSet: string[];
    guardrails: string[];
    dflow: {
        spotTradingDefault: boolean;
        predictionMarketDefault: boolean;
        credentialEnv: "DFLOW_API_KEY";
    };
}
/**
 * Classify a task with a confidence score.
 * Returns the best match. If no patterns hit, falls back to "general" with low confidence.
 */
export declare function classifyMagicRouterTask(input: string | string[] | undefined): MagicRouterTaskType;
export declare function classifyMagicRouterTaskWithConfidence(input: string | string[] | undefined): {
    type: MagicRouterTaskType;
    confidence: number;
};
export declare function resolveMagicRouter(input: string | string[] | undefined, env?: EnvLike): MagicRouterRoute;
export declare function describeMagicRouter(route: MagicRouterRoute): string;
export declare function describeMagicRouterPretty(route: MagicRouterRoute): string;
/**
 * Get the full task metadata catalog — useful for docs / help output.
 */
export declare function getTaskCatalog(): Array<{
    type: MagicRouterTaskType;
} & Omit<MagicRouterTaskMetadata, "type" | "confidence">>;
export {};
//# sourceMappingURL=magic-router.d.ts.map