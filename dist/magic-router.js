"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENROUTER_API_URL = exports.OPENROUTER_AUTO_MODEL = exports.OPENROUTER_PROVIDER = exports.NVIDIA_FALLBACK_MODEL = exports.NVIDIA_FALLBACK_PROVIDER = exports.ZAI_DEFAULT_MODEL = exports.ZAI_DEFAULT_PROVIDER = exports.MAGIC_ROUTER_STRATEGY = void 0;
exports.classifyMagicRouterTask = classifyMagicRouterTask;
exports.resolveMagicRouter = resolveMagicRouter;
exports.describeMagicRouter = describeMagicRouter;
const agent_mode_js_1 = require("./agent-mode.js");
exports.MAGIC_ROUTER_STRATEGY = "magic-router";
exports.ZAI_DEFAULT_PROVIDER = "zai-glm";
exports.ZAI_DEFAULT_MODEL = "zai/glm-5.2";
exports.NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
exports.NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b";
exports.OPENROUTER_PROVIDER = "openrouter";
exports.OPENROUTER_AUTO_MODEL = "openrouter/auto";
exports.OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
function hasEnv(env, key) {
    return Boolean(env[key]?.trim());
}
function textFromInput(input) {
    if (Array.isArray(input))
        return input.join(" ");
    return input || "";
}
function classifyMagicRouterTask(input) {
    const text = textFromInput(input).toLowerCase();
    if (/\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc|proof)\b/.test(text))
        return "prediction_market";
    if (/\b(swap|trade|route|quote|slippage|jupiter|dflow|sol\/usdc|usdc|mint)\b/.test(text))
        return "solana_trading";
    if (/\b(wallet|sign|signature|keypair|balance|airdrop|transfer|send sol|private wallet)\b/.test(text))
        return "wallet_ops";
    if (/\b(code|build|test|debug|typescript|python|repo|script|compile|install)\b/.test(text))
        return "coding";
    if (/\b(research|search|docs|summarize|latest|compare|benchmark)\b/.test(text))
        return "research";
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
        provider: exports.ZAI_DEFAULT_PROVIDER,
        model: exports.ZAI_DEFAULT_MODEL,
        credentialEnv: "ZAI_API_KEY",
        available: hasEnv(env, "ZAI_API_KEY"),
        role: "selected",
        reason: "Default Nemo Clawd inference route for GLM 5.2.",
    };
    const openrouter = {
        provider: exports.OPENROUTER_PROVIDER,
        model: env.OPENROUTER_MODEL?.trim() || exports.OPENROUTER_AUTO_MODEL,
        credentialEnv: "OPENROUTER_API_KEY",
        available: hasEnv(env, "OPENROUTER_API_KEY"),
        role: "advisor",
        endpoint: exports.OPENROUTER_API_URL,
        reason: "OpenRouter Auto Router can select the best model for the prompt when enabled.",
    };
    const nvidia = {
        provider: exports.NVIDIA_FALLBACK_PROVIDER,
        model: exports.NVIDIA_FALLBACK_MODEL,
        credentialEnv: "NVIDIA_API_KEY",
        available: hasEnv(env, "NVIDIA_API_KEY"),
        role: "fallback",
        reason: "NVIDIA NIM fallback for NVIDIA-hosted inference.",
    };
    if (zai.available)
        return { selected: zai, advisor: openrouter.available ? openrouter : undefined, fallbacks: [openrouter, nvidia].filter((r) => r.provider !== zai.provider) };
    if (openrouter.available)
        return { selected: { ...openrouter, role: "selected" }, advisor: undefined, fallbacks: [zai, nvidia] };
    if (nvidia.available)
        return { selected: { ...nvidia, role: "selected" }, advisor: openrouter, fallbacks: [zai, openrouter] };
    return { selected: zai, advisor: openrouter, fallbacks: [openrouter, nvidia] };
}
function resolveMagicRouter(input, env = process.env, mode = (0, agent_mode_js_1.getAgentMode)(env)) {
    const taskType = classifyMagicRouterTask(input);
    const routes = buildInferenceRoutes(env);
    const openRouterAvailable = routes.selected.provider === exports.OPENROUTER_PROVIDER || routes.advisor?.provider === exports.OPENROUTER_PROVIDER;
    const rawToolSet = toolSetForTask(taskType, Boolean(openRouterAvailable));
    const { allowed: toolSet, blocked: blockedTools } = (0, agent_mode_js_1.partitionToolsForMode)(rawToolSet, mode);
    const aiMode = mode === "ai";
    const guardrails = [
        "least-privilege-tools",
        "read-only-before-signing",
        "explicit-approval-before-wallet-actions",
        "no-private-key-or-seed-phrase-handling",
    ];
    if (aiMode)
        guardrails.push("ai-mode-financial-tools-disabled");
    return {
        strategy: exports.MAGIC_ROUTER_STRATEGY,
        mode,
        taskType,
        inference: routes.selected,
        advisor: routes.advisor,
        fallbacks: routes.fallbacks,
        toolSet,
        blockedTools,
        guardrails,
        dflow: {
            spotTradingDefault: !aiMode,
            predictionMarketDefault: !aiMode,
            credentialEnv: "DFLOW_API_KEY",
        },
    };
}
function describeMagicRouter(route) {
    const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
    const blocked = route.blockedTools.length ? `; blocked=${route.blockedTools.join(",")}` : "";
    return `${route.strategy}[${route.mode}]: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}${blocked}`;
}
//# sourceMappingURL=magic-router.js.map