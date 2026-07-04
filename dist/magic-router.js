"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.NVIDIA_FALLBACK_MODEL = exports.NVIDIA_FALLBACK_PROVIDER = exports.OPENROUTER_API_URL = exports.OPENROUTER_AUTO_MODEL = exports.OPENROUTER_PROVIDER = exports.OLLAMA_DEFAULT_MODEL = exports.OLLAMA_DEFAULT_PROVIDER = exports.MAGIC_ROUTER_STRATEGY = void 0;
exports.classifyMagicRouterTask = classifyMagicRouterTask;
exports.resolveMagicRouter = resolveMagicRouter;
exports.describeMagicRouter = describeMagicRouter;
exports.MAGIC_ROUTER_STRATEGY = "magic-router";
exports.OLLAMA_DEFAULT_PROVIDER = "ollama-local";
exports.OLLAMA_DEFAULT_MODEL = "hf.co/ordlibrary/hauhau-qwen36-onchain";
exports.OPENROUTER_PROVIDER = "openrouter";
exports.OPENROUTER_AUTO_MODEL = "openrouter/auto";
exports.OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
exports.NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
exports.NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
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
    if (/\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc)\b/.test(text))
        return "prediction_market";
    if (/\b(zk|zero[- ]knowledge|groth16|nullifier|attest|attestation|publish_attestation|commit_encrypted_state|encrypted state|ciphertext commitment|validity proof|compressed state|light protocol|proof)\b/.test(text))
        return "zk_proof";
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
function buildInferenceRoutes(env) {
    const ollama = {
        provider: exports.OLLAMA_DEFAULT_PROVIDER,
        model: env.OLLAMA_MODEL?.trim() || exports.OLLAMA_DEFAULT_MODEL,
        credentialEnv: "OLLAMA_HOST",
        available: true,
        role: "selected",
        reason: "Default Ollama inference route — hf.co/ordlibrary/hauhau-qwen36-onchain runs locally.",
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
        model: env.NEMOCLAWD_NVIDIA_MODEL?.trim() || env.NVIDIA_MODEL?.trim() || exports.NVIDIA_FALLBACK_MODEL,
        credentialEnv: "NVIDIA_API_KEY",
        available: hasEnv(env, "NVIDIA_API_KEY"),
        role: "fallback",
        reason: "NVIDIA NIM fallback for NVIDIA-hosted inference.",
    };
    return {
        selected: ollama,
        advisor: openrouter.available ? openrouter : undefined,
        fallbacks: [openrouter, nvidia],
    };
}
function resolveMagicRouter(input, env = process.env) {
    const taskType = classifyMagicRouterTask(input);
    const routes = buildInferenceRoutes(env);
    const openRouterAvailable = routes.selected.provider === exports.OPENROUTER_PROVIDER || routes.advisor?.provider === exports.OPENROUTER_PROVIDER;
    return {
        strategy: exports.MAGIC_ROUTER_STRATEGY,
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
//# sourceMappingURL=magic-router.js.map