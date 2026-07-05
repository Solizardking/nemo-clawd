// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_AGENT_MODE, FINANCIAL_TOOLS, type AgentMode } from "./agent-mode.js";
import {
  classifyTask,
  createRouter,
  type CategorizedTool,
  type EnvLike,
  type InferenceProviderConfig,
  type InferenceRoute,
  type RouterMode,
  type TaskClassifier,
} from "./router/core.js";

export const MAGIC_ROUTER_STRATEGY = "magic-router";
export const ZAI_DEFAULT_PROVIDER = "zai-glm";
export const ZAI_DEFAULT_MODEL = "zai/glm-5.2";
export const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
export const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const OPENROUTER_PROVIDER = "openrouter";
export const OPENROUTER_AUTO_MODEL = "openrouter/auto";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type MagicRouterTaskType =
  | "coding"
  | "solana_trading"
  | "prediction_market"
  | "wallet_ops"
  | "research"
  | "general";

export type MagicRouterInferenceRoute = InferenceRoute;

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

const TASK_CLASSIFIERS: TaskClassifier<MagicRouterTaskType>[] = [
  {
    taskType: "prediction_market",
    test: (text) => /\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc|proof)\b/.test(text),
  },
  {
    taskType: "solana_trading",
    test: (text) => /\b(swap|trade|route|quote|slippage|jupiter|dflow|sol\/usdc|usdc|mint)\b/.test(text),
  },
  {
    taskType: "wallet_ops",
    test: (text) => /\b(wallet|sign|signature|keypair|balance|airdrop|transfer|send sol|private wallet)\b/.test(text),
  },
  {
    taskType: "coding",
    test: (text) => /\b(code|build|test|debug|typescript|python|repo|script|compile|install)\b/.test(text),
  },
  {
    taskType: "research",
    test: (text) => /\b(research|search|docs|summarize|latest|compare|benchmark)\b/.test(text),
  },
];
const DEFAULT_TASK_TYPE: MagicRouterTaskType = "general";

export function classifyMagicRouterTask(input: string | string[] | undefined): MagicRouterTaskType {
  return classifyTask(input, TASK_CLASSIFIERS, DEFAULT_TASK_TYPE);
}

const OPENROUTER_AUTO_ROUTER_TOOL = "openrouter-auto-router";

function tagCategories(id: string): CategorizedTool {
  return { id, categories: FINANCIAL_TOOLS.has(id) ? ["financial"] : [] };
}

function toolsForTask(
  taskType: MagicRouterTaskType,
  ctx: { env: EnvLike; inference: { selected: InferenceRoute; advisor?: InferenceRoute } },
): CategorizedTool[] {
  const openRouterAvailable =
    ctx.inference.selected.provider === OPENROUTER_PROVIDER || ctx.inference.advisor?.provider === OPENROUTER_PROVIDER;
  const openRouterTool = openRouterAvailable ? [OPENROUTER_AUTO_ROUTER_TOOL] : [];

  const ids: string[] = (() => {
    switch (taskType) {
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
  })();

  return ids.map(tagCategories);
}

function inferenceProviders(env: EnvLike): InferenceProviderConfig[] {
  return [
    {
      provider: ZAI_DEFAULT_PROVIDER,
      model: ZAI_DEFAULT_MODEL,
      credentialEnv: "ZAI_API_KEY",
      role: "selected",
      reason: "Default Nemo Clawd inference route for GLM 5.2.",
      priority: 0,
    },
    {
      provider: OPENROUTER_PROVIDER,
      model: env.OPENROUTER_MODEL?.trim() || OPENROUTER_AUTO_MODEL,
      credentialEnv: "OPENROUTER_API_KEY",
      role: "advisor",
      endpoint: OPENROUTER_API_URL,
      reason: "OpenRouter Auto Router can select the best model for the prompt when enabled.",
      priority: 1,
    },
    {
      provider: NVIDIA_FALLBACK_PROVIDER,
      model: NVIDIA_FALLBACK_MODEL,
      credentialEnv: "NVIDIA_API_KEY",
      role: "fallback",
      reason: "NVIDIA NIM fallback for NVIDIA-hosted inference.",
      priority: 2,
    },
  ];
}

const MAGIC_ROUTER_MODES: RouterMode<AgentMode>[] = [
  { id: "trading", blockedCategories: [] },
  { id: "ai", blockedCategories: ["financial"], extraGuardrails: ["ai-mode-financial-tools-disabled"] },
];

const BASE_GUARDRAILS = [
  "least-privilege-tools",
  "read-only-before-signing",
  "explicit-approval-before-wallet-actions",
  "no-private-key-or-seed-phrase-handling",
];

const router = createRouter<MagicRouterTaskType, AgentMode>({
  strategy: MAGIC_ROUTER_STRATEGY,
  classifiers: TASK_CLASSIFIERS,
  defaultTaskType: DEFAULT_TASK_TYPE,
  toolsForTask,
  inferenceProviders,
  modes: MAGIC_ROUTER_MODES,
  defaultMode: DEFAULT_AGENT_MODE,
  baseGuardrails: BASE_GUARDRAILS,
  extend: ({ mode }) => ({
    dflow: {
      spotTradingDefault: mode !== "ai",
      predictionMarketDefault: mode !== "ai",
      credentialEnv: "DFLOW_API_KEY" as const,
    },
  }),
});

export function resolveMagicRouter(
  input: string | string[] | undefined,
  env: EnvLike = process.env,
  mode: AgentMode = DEFAULT_AGENT_MODE,
): MagicRouterRoute {
  const { extensions, ...route } = router.resolve(input, env, mode);
  return { ...route, dflow: extensions.dflow as MagicRouterRoute["dflow"] } as MagicRouterRoute;
}

export function describeMagicRouter(route: MagicRouterRoute): string {
  return router.describe(route);
}
