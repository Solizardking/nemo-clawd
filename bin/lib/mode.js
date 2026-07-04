// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

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

const fs = require("fs");
const os = require("os");
const path = require("path");

const AGENT_MODES = ["ai", "trading"];
const DEFAULT_AGENT_MODE = "trading";

const FINANCIAL_TOOLS = new Set([
  "dflow-order",
  "dflow-book-stream",
  "dflow-prediction-metadata",
  "proof-kyc-check",
  "solana-rpc",
  "wallet-approval",
  "openshell-private-wallet",
]);

function isAgentMode(value) {
  return value === "ai" || value === "trading";
}

function partitionToolsForMode(toolSet, mode) {
  if (mode !== "ai") return { allowed: [...toolSet], blocked: [] };
  const allowed = [];
  const blocked = [];
  for (const tool of toolSet) {
    (FINANCIAL_TOOLS.has(tool) ? blocked : allowed).push(tool);
  }
  return { allowed, blocked };
}

function modeStateDir(env = process.env) {
  return path.join(env.HOME || os.homedir() || "/tmp", ".nemoclawd");
}

function modeStatePath(env = process.env) {
  return path.join(modeStateDir(env), "mode.json");
}

function getAgentMode(env = process.env) {
  if (isAgentMode(env.NEMOCLAWD_MODE)) return env.NEMOCLAWD_MODE;

  const statePath = modeStatePath(env);
  if (!fs.existsSync(statePath)) return DEFAULT_AGENT_MODE;
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    if (isAgentMode(parsed.mode)) return parsed.mode;
  } catch {
    // Corrupt or unreadable state file — fall back to the default.
  }
  return DEFAULT_AGENT_MODE;
}

function setAgentMode(mode, env = process.env) {
  if (!isAgentMode(mode)) {
    throw new Error(`Invalid agent mode "${String(mode)}". Expected one of: ${AGENT_MODES.join(", ")}`);
  }
  const dir = modeStateDir(env);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const state = { mode, updatedAt: new Date().toISOString() };
  fs.writeFileSync(modeStatePath(env), JSON.stringify(state, null, 2), { mode: 0o600 });
  return mode;
}

function describeAgentMode(mode) {
  return mode === "ai"
    ? "AI Mode: conversational AI, coding, and research only — wallet, signing, and trading tools are disabled."
    : "Trading Mode: full Solana trading, wallet, and prediction-market tools available (default).";
}

module.exports = {
  AGENT_MODES,
  DEFAULT_AGENT_MODE,
  FINANCIAL_TOOLS,
  isAgentMode,
  partitionToolsForMode,
  getAgentMode,
  setAgentMode,
  describeAgentMode,
};
