// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const MAGIC_ROUTER_STRATEGY = "magic-router";
export const ZAI_DEFAULT_PROVIDER = "zai-glm";
export const ZAI_DEFAULT_MODEL = "zai/glm-5.2";
export const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
export const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const OPENROUTER_PROVIDER = "openrouter";
export const OPENROUTER_AUTO_MODEL = "openrouter/auto";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

type EnvLike = Record<string, string | undefined>;

export type MagicRouterTaskType =
  | "coding"
  | "zk_proof"
  | "solana_trading"
  | "prediction_market"
  | "wallet_ops"
  | "research"
  | "general";

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
  taskType: MagicRouterTaskType;
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

function hasEnv(env: EnvLike, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function textFromInput(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input.join(" ");
  return input || "";
}

export function classifyMagicRouterTask(input: string | string[] | undefined): MagicRouterTaskType {
  const text = textFromInput(input).toLowerCase();
  if (/\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc)\b/.test(text)) return "prediction_market";
  if (/\b(zk|zero[- ]knowledge|groth16|nullifier|attest|attestation|publish_attestation|commit_encrypted_state|encrypted state|ciphertext commitment|validity proof|compressed state|light protocol|proof)\b/.test(text)) return "zk_proof";
  if (/\b(swap|trade|route|quote|slippage|jupiter|dflow|sol\/usdc|usdc|mint)\b/.test(text)) return "solana_trading";
  if (/\b(wallet|sign|signature|keypair|balance|airdrop|transfer|send sol|private wallet)\b/.test(text)) return "wallet_ops";
  if (/\b(code|build|test|debug|typescript|python|repo|script|compile|install)\b/.test(text)) return "coding";
  if (/\b(research|search|docs|summarize|latest|compare|benchmark)\b/.test(text)) return "research";
  return "general";
}

function toolSetForTask(taskType: MagicRouterTaskType, openRouterAvailable: boolean): string[] {
  const openRouterTool = openRouterAvailable ? ["openrouter-auto-router"] : [];
  switch (taskType) {
    case "zk_proof":
      return ["clawd-zk-agent", "clawd-zk-client", "light-protocol", "solana-rpc", "instruction-builder", "wallet-approval", ...openRouterTool];
    case "prediction_market":
      return ["dflow-prediction-metadata", "dflow-order", "proof-kyc-check", "solana-rpc", "wallet-approval", ...openRouterTool];
    case "solana_trading":
      return ["dflow-order", "dflow-book-stream", "solana-rpc", "wallet-approval", ...openRouterTool];
    case "wallet_ops":
      return ["openshell-private-wallet", "solana-rpc", "wallet-approval"];
    case "coding":
      return ["filesystem", "shell", "git", "test-runner", ...openRouterTool];
    case "research":
      return ["docs-fetch", "web-search", ...openRouterTool];
    case "general":
    default:
      return ["chat", ...openRouterTool];
  }
}

function buildInferenceRoutes(env: EnvLike): { selected: MagicRouterInferenceRoute; advisor?: MagicRouterInferenceRoute; fallbacks: MagicRouterInferenceRoute[] } {
  const zai: MagicRouterInferenceRoute = {
    provider: ZAI_DEFAULT_PROVIDER,
    model: ZAI_DEFAULT_MODEL,
    credentialEnv: "ZAI_API_KEY",
    available: hasEnv(env, "ZAI_API_KEY"),
    role: "selected",
    reason: "Default Nemo Clawd inference route for GLM 5.2.",
  };

  const openrouter: MagicRouterInferenceRoute = {
    provider: OPENROUTER_PROVIDER,
    model: env.OPENROUTER_MODEL?.trim() || OPENROUTER_AUTO_MODEL,
    credentialEnv: "OPENROUTER_API_KEY",
    available: hasEnv(env, "OPENROUTER_API_KEY"),
    role: "advisor",
    endpoint: OPENROUTER_API_URL,
    reason: "OpenRouter Auto Router can select the best model for the prompt when enabled.",
  };

  const nvidia: MagicRouterInferenceRoute = {
    provider: NVIDIA_FALLBACK_PROVIDER,
    model: NVIDIA_FALLBACK_MODEL,
    credentialEnv: "NVIDIA_API_KEY",
    available: hasEnv(env, "NVIDIA_API_KEY"),
    role: "fallback",
    reason: "NVIDIA NIM fallback for NVIDIA-hosted inference.",
  };

  if (zai.available) return { selected: zai, advisor: openrouter.available ? openrouter : undefined, fallbacks: [openrouter, nvidia].filter((r) => r.provider !== zai.provider) };
  if (openrouter.available) return { selected: { ...openrouter, role: "selected" }, advisor: undefined, fallbacks: [zai, nvidia] };
  if (nvidia.available) return { selected: { ...nvidia, role: "selected" }, advisor: openrouter, fallbacks: [zai, openrouter] };
  return { selected: zai, advisor: openrouter, fallbacks: [openrouter, nvidia] };
}

export function resolveMagicRouter(input: string | string[] | undefined, env: EnvLike = process.env): MagicRouterRoute {
  const taskType = classifyMagicRouterTask(input);
  const routes = buildInferenceRoutes(env);
  const openRouterAvailable = routes.selected.provider === OPENROUTER_PROVIDER || routes.advisor?.provider === OPENROUTER_PROVIDER;
  return {
    strategy: MAGIC_ROUTER_STRATEGY,
    taskType,
    inference: routes.selected,
    advisor: routes.advisor,
    fallbacks: routes.fallbacks,
    toolSet: toolSetForTask(taskType, Boolean(openRouterAvailable)),
    guardrails: [
      "least-privilege-tools",
      "read-only-before-signing",
      "explicit-approval-before-wallet-actions",
      "no-private-key-or-seed-phrase-handling",
    ],
    dflow: {
      spotTradingDefault: true,
      predictionMarketDefault: true,
      credentialEnv: "DFLOW_API_KEY",
    },
  };
}

export function describeMagicRouter(route: MagicRouterRoute): string {
  const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
  return `${route.strategy}: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}`;
}
