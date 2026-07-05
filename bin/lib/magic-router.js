// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { DEFAULT_AGENT_MODE, FINANCIAL_TOOLS } = require("./mode");
const { classifyTask, createRouter } = require("./router-core");

const MAGIC_ROUTER_STRATEGY = "magic-router";
const ZAI_DEFAULT_PROVIDER = "zai-glm";
const ZAI_DEFAULT_MODEL = "zai/glm-5.2";
const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const OPENROUTER_PROVIDER = "openrouter";
const OPENROUTER_AUTO_MODEL = "openrouter/auto";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const TASK_CLASSIFIERS = [
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
const DEFAULT_TASK_TYPE = "general";

function classifyMagicRouterTask(input) {
  return classifyTask(input, TASK_CLASSIFIERS, DEFAULT_TASK_TYPE);
}

const OPENROUTER_AUTO_ROUTER_TOOL = "openrouter-auto-router";

function tagCategories(id) {
  return { id, categories: FINANCIAL_TOOLS.has(id) ? ["financial"] : [] };
}

function toolsForTask(taskType, ctx) {
  const openRouterAvailable =
    ctx.inference.selected.provider === OPENROUTER_PROVIDER || (ctx.inference.advisor && ctx.inference.advisor.provider === OPENROUTER_PROVIDER);
  const openRouterTool = openRouterAvailable ? [OPENROUTER_AUTO_ROUTER_TOOL] : [];

  let ids;
  switch (taskType) {
    case "prediction_market":
      ids = ["dflow-prediction-metadata", "dflow-order", "proof-kyc-check", "solana-rpc", "wallet-approval", ...openRouterTool];
      break;
    case "solana_trading":
      ids = ["dflow-order", "dflow-book-stream", "solana-rpc", "wallet-approval", ...openRouterTool];
      break;
    case "wallet_ops":
      ids = ["openshell-private-wallet", "solana-rpc", "wallet-approval"];
      break;
    case "coding":
      ids = ["filesystem", "shell", "git", "test-runner", ...openRouterTool];
      break;
    case "research":
      ids = ["docs-fetch", "web-search", ...openRouterTool];
      break;
    case "general":
    default:
      ids = ["chat", ...openRouterTool];
  }

  return ids.map(tagCategories);
}

function inferenceProviders(env) {
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
      model: env.OPENROUTER_MODEL && String(env.OPENROUTER_MODEL).trim() ? String(env.OPENROUTER_MODEL).trim() : OPENROUTER_AUTO_MODEL,
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

const MAGIC_ROUTER_MODES = [
  { id: "trading", blockedCategories: [] },
  { id: "ai", blockedCategories: ["financial"], extraGuardrails: ["ai-mode-financial-tools-disabled"] },
];

const BASE_GUARDRAILS = [
  "least-privilege-tools",
  "read-only-before-signing",
  "explicit-approval-before-wallet-actions",
  "no-private-key-or-seed-phrase-handling",
];

const router = createRouter({
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
      credentialEnv: "DFLOW_API_KEY",
    },
  }),
});

function resolveMagicRouter(input, env = process.env, mode = DEFAULT_AGENT_MODE) {
  const { extensions, ...route } = router.resolve(input, env, mode);
  return { ...route, dflow: extensions.dflow };
}

function describeMagicRouter(route) {
  return router.describe(route);
}

module.exports = {
  MAGIC_ROUTER_STRATEGY,
  ZAI_DEFAULT_PROVIDER,
  ZAI_DEFAULT_MODEL,
  NVIDIA_FALLBACK_PROVIDER,
  NVIDIA_FALLBACK_MODEL,
  OPENROUTER_PROVIDER,
  OPENROUTER_AUTO_MODEL,
  OPENROUTER_API_URL,
  classifyMagicRouterTask,
  resolveMagicRouter,
  describeMagicRouter,
};
