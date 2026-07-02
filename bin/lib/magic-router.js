// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const MAGIC_ROUTER_STRATEGY = "magic-router";
const ZAI_DEFAULT_PROVIDER = "zai-glm";
const ZAI_DEFAULT_MODEL = "zai/glm-5.2";
const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
const OPENROUTER_PROVIDER = "openrouter";
const OPENROUTER_AUTO_MODEL = "openrouter/auto";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function hasEnv(env, key) {
  return Boolean(env[key] && String(env[key]).trim());
}

function textFromInput(input) {
  if (Array.isArray(input)) return input.join(" ");
  return input || "";
}

function classifyMagicRouterTask(input) {
  const text = textFromInput(input).toLowerCase();
  if (/\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc|proof)\b/.test(text)) return "prediction_market";
  if (/\b(swap|trade|route|quote|slippage|jupiter|dflow|sol\/usdc|usdc|mint)\b/.test(text)) return "solana_trading";
  if (/\b(wallet|sign|signature|keypair|balance|airdrop|transfer|send sol|private wallet)\b/.test(text)) return "wallet_ops";
  if (/\b(code|build|test|debug|typescript|python|repo|script|compile|install)\b/.test(text)) return "coding";
  if (/\b(research|search|docs|summarize|latest|compare|benchmark)\b/.test(text)) return "research";
  return "general";
}

function toolSetForTask(taskType, openRouterAvailable) {
  const openRouterTool = openRouterAvailable ? ["openrouter-auto-router"] : [];
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
}

function buildInferenceRoutes(env) {
  const zai = {
    provider: ZAI_DEFAULT_PROVIDER,
    model: ZAI_DEFAULT_MODEL,
    credentialEnv: "ZAI_API_KEY",
    available: hasEnv(env, "ZAI_API_KEY"),
    role: "selected",
    reason: "Default Nemo Clawd inference route for GLM 5.2.",
  };

  const openrouter = {
    provider: OPENROUTER_PROVIDER,
    model: env.OPENROUTER_MODEL && String(env.OPENROUTER_MODEL).trim() ? String(env.OPENROUTER_MODEL).trim() : OPENROUTER_AUTO_MODEL,
    credentialEnv: "OPENROUTER_API_KEY",
    available: hasEnv(env, "OPENROUTER_API_KEY"),
    role: "advisor",
    endpoint: OPENROUTER_API_URL,
    reason: "OpenRouter Auto Router can select the best model for the prompt when enabled.",
  };

  const nvidia = {
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

function resolveMagicRouter(input, env = process.env) {
  const taskType = classifyMagicRouterTask(input);
  const routes = buildInferenceRoutes(env);
  const openRouterAvailable = routes.selected.provider === OPENROUTER_PROVIDER || (routes.advisor && routes.advisor.provider === OPENROUTER_PROVIDER);
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

function describeMagicRouter(route) {
  const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
  return `${route.strategy}: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}`;
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
