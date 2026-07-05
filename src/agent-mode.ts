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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { partitionByCategories } from "./router/core.js";

export type AgentMode = "ai" | "trading";

export const AGENT_MODES: readonly AgentMode[] = ["ai", "trading"];
export const DEFAULT_AGENT_MODE: AgentMode = "trading";

/** Tool identifiers that touch wallets, signing, or on-chain trading. */
export const FINANCIAL_TOOLS: ReadonlySet<string> = new Set([
  "dflow-order",
  "dflow-book-stream",
  "dflow-prediction-metadata",
  "proof-kyc-check",
  "solana-rpc",
  "wallet-approval",
  "openshell-private-wallet",
]);

export function isAgentMode(value: unknown): value is AgentMode {
  return value === "ai" || value === "trading";
}

/** Remove financial tools from a tool set. Returns [allowed, blocked]. */
export function partitionToolsForMode(
  toolSet: readonly string[],
  mode: AgentMode,
): { allowed: string[]; blocked: string[] } {
  const blockedCategories = mode === "ai" ? ["financial"] : [];
  const tools = toolSet.map((id) => ({ id, categories: FINANCIAL_TOOLS.has(id) ? ["financial"] : [] }));
  return partitionByCategories(tools, blockedCategories);
}

function modeStateDir(env: Record<string, string | undefined> = process.env): string {
  return join(env.HOME || homedir() || "/tmp", ".nemoclawd");
}

function modeStatePath(env: Record<string, string | undefined> = process.env): string {
  return join(modeStateDir(env), "mode.json");
}

interface ModeState {
  mode: AgentMode;
  updatedAt: string;
}

/**
 * Resolve the active agent mode: explicit env override, then persisted
 * state file, then the default (Trading Mode, preserving prior behavior).
 */
export function getAgentMode(env: Record<string, string | undefined> = process.env): AgentMode {
  if (isAgentMode(env.NEMOCLAWD_MODE)) return env.NEMOCLAWD_MODE;

  const statePath = modeStatePath(env);
  if (!existsSync(statePath)) return DEFAULT_AGENT_MODE;
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf-8")) as Partial<ModeState>;
    if (isAgentMode(parsed.mode)) return parsed.mode;
  } catch {
    // Corrupt or unreadable state file — fall back to the default.
  }
  return DEFAULT_AGENT_MODE;
}

export function setAgentMode(mode: AgentMode, env: Record<string, string | undefined> = process.env): AgentMode {
  if (!isAgentMode(mode)) {
    throw new Error(`Invalid agent mode "${String(mode)}". Expected one of: ${AGENT_MODES.join(", ")}`);
  }
  const dir = modeStateDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const state: ModeState = { mode, updatedAt: new Date().toISOString() };
  writeFileSync(modeStatePath(env), JSON.stringify(state, null, 2), { mode: 0o600 });
  return mode;
}

export function describeAgentMode(mode: AgentMode): string {
  return mode === "ai"
    ? "AI Mode: conversational AI, coding, and research only — wallet, signing, and trading tools are disabled."
    : "Trading Mode: full Solana trading, wallet, and prediction-market tools available (default).";
}
