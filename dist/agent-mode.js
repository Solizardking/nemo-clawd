"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINANCIAL_TOOLS = exports.DEFAULT_AGENT_MODE = exports.AGENT_MODES = void 0;
exports.isAgentMode = isAgentMode;
exports.partitionToolsForMode = partitionToolsForMode;
exports.getAgentMode = getAgentMode;
exports.setAgentMode = setAgentMode;
exports.describeAgentMode = describeAgentMode;
/**
 * AI Mode — a persistent, explicit operating mode for the Nemo Clawd agent.
 *
 * Trading Mode (default) preserves existing behavior: the magic router may
 * grant wallet, signing, and DFlow trading tools whenever a request classifies
 * as solana_trading, prediction_market, or wallet_ops.
 *
 * AI Mode restricts the agent to a conversational AI / coding / research
 * assistant. It hard-disables every financial tool at the router level,
 * regardless of how a given message classifies, so a misclassified or
 * adversarial prompt cannot reach wallet or trading tools. This is
 * enforced in addition to (not instead of) per-message classification.
 */
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
exports.AGENT_MODES = ["ai", "trading"];
exports.DEFAULT_AGENT_MODE = "trading";
/** Tool identifiers that touch wallets, signing, or on-chain trading. */
exports.FINANCIAL_TOOLS = new Set([
    "dflow-order",
    "dflow-book-stream",
    "dflow-prediction-metadata",
    "proof-kyc-check",
    "solana-rpc",
    "wallet-approval",
    "openshell-private-wallet",
    "keypair-gen",
    "instruction-builder",
    "nft-mint",
    "magic-eden-api",
    "tensor-api",
]);
function isAgentMode(value) {
    return value === "ai" || value === "trading";
}
/** Remove financial tools from a tool set. Returns [allowed, blocked]. */
function partitionToolsForMode(toolSet, mode) {
    if (mode !== "ai")
        return { allowed: [...toolSet], blocked: [] };
    const allowed = [];
    const blocked = [];
    for (const tool of toolSet) {
        (exports.FINANCIAL_TOOLS.has(tool) ? blocked : allowed).push(tool);
    }
    return { allowed, blocked };
}
function modeStateDir(env = process.env) {
    return (0, node_path_1.join)(env.HOME || (0, node_os_1.homedir)() || "/tmp", ".nemoclawd");
}
function modeStatePath(env = process.env) {
    return (0, node_path_1.join)(modeStateDir(env), "mode.json");
}
/**
 * Resolve the active agent mode: explicit env override, then persisted
 * state file, then the default (Trading Mode, preserving prior behavior).
 */
function getAgentMode(env = process.env) {
    const envOverride = env.NEMOCLAWD_MODE?.trim();
    if (envOverride) {
        if (!isAgentMode(envOverride)) {
            throw new Error(`Invalid NEMOCLAWD_MODE "${envOverride}". Expected one of: ${exports.AGENT_MODES.join(", ")}`);
        }
        return envOverride;
    }
    const statePath = modeStatePath(env);
    if (!(0, node_fs_1.existsSync)(statePath))
        return exports.DEFAULT_AGENT_MODE;
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(statePath, "utf-8"));
        if (isAgentMode(parsed.mode))
            return parsed.mode;
    }
    catch {
        // Corrupt or unreadable state file — fall back to the default.
    }
    return exports.DEFAULT_AGENT_MODE;
}
function setAgentMode(mode, env = process.env) {
    if (!isAgentMode(mode)) {
        throw new Error(`Invalid agent mode "${String(mode)}". Expected one of: ${exports.AGENT_MODES.join(", ")}`);
    }
    const dir = modeStateDir(env);
    (0, node_fs_1.mkdirSync)(dir, { recursive: true, mode: 0o700 });
    const state = { mode, updatedAt: new Date().toISOString() };
    (0, node_fs_1.writeFileSync)(modeStatePath(env), JSON.stringify(state, null, 2), { mode: 0o600 });
    return mode;
}
function describeAgentMode(mode) {
    return mode === "ai"
        ? "AI Mode: conversational AI, coding, and research only — wallet, signing, and trading tools are disabled."
        : "Trading Mode: full Solana trading, wallet, and prediction-market tools available (default).";
}
//# sourceMappingURL=agent-mode.js.map