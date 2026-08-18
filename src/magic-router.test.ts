// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMagicRouter } from "./magic-router.js";
import { FINANCIAL_TOOLS, setAgentMode } from "./agent-mode.js";

// resolveMagicRouter's mode argument now defaults to the persisted agent mode
// (see agent-mode.ts getAgentMode). Point env fixtures that omit an explicit
// mode at an isolated, empty HOME so "no mode.json" -> "trading" is
// deterministic and independent of the real machine's ~/.nemoclawd state.
const isolatedHome = mkdtempSync(join(tmpdir(), "nemoclawd-magic-router-test-"));
const env = { HOME: isolatedHome, ZAI_API_KEY: "zai-test" };

describe("resolveMagicRouter mode gating", () => {
  it("defaults to trading mode and grants wallet tools for wallet_ops", () => {
    const route = resolveMagicRouter("check my wallet balance", env);
    expect(route.mode).toBe("trading");
    expect(route.toolSet).toContain("solana-rpc");
    expect(route.blockedTools).toEqual([]);
  });

  it("resolves the persisted mode when the mode argument is omitted, so old call sites can't bypass AI Mode", () => {
    const home = mkdtempSync(join(tmpdir(), "nemoclawd-magic-router-persisted-"));
    setAgentMode("ai", { HOME: home });

    const route = resolveMagicRouter("check my wallet balance", { HOME: home, ZAI_API_KEY: "zai-test" });
    expect(route.mode).toBe("ai");
    expect(route.toolSet).not.toContain("solana-rpc");
    expect(route.blockedTools).toContain("solana-rpc");
  });

  it("in ai mode, strips every financial tool from a wallet_ops request", () => {
    const route = resolveMagicRouter("check my wallet balance", env, "ai");
    expect(route.mode).toBe("ai");
    expect(route.taskType).toBe("wallet_ops");
    for (const tool of route.toolSet) {
      expect(FINANCIAL_TOOLS.has(tool)).toBe(false);
    }
    expect(route.blockedTools.length).toBeGreaterThan(0);
    expect(route.guardrails).toContain("ai-mode-financial-tools-disabled");
  });

  it("in ai mode, strips dflow and proof/kyc tools from a prediction-market request", () => {
    const route = resolveMagicRouter("quote a Kalshi prediction market YES token", env, "ai");
    expect(route.taskType).toBe("prediction_market");
    expect(route.toolSet).not.toContain("dflow-prediction-metadata");
    expect(route.toolSet).not.toContain("proof-kyc-check");
    expect(route.blockedTools).toEqual(
      expect.arrayContaining(["dflow-prediction-metadata", "dflow-order", "proof-kyc-check", "solana-rpc", "wallet-approval"]),
    );
  });

  it("leaves coding and research tool sets untouched by ai mode (no financial tools present)", () => {
    const trading = resolveMagicRouter("debug this TypeScript repo", env, "trading");
    const ai = resolveMagicRouter("debug this TypeScript repo", env, "ai");
    expect(ai.toolSet).toEqual(trading.toolSet);
    expect(ai.blockedTools).toEqual([]);
  });

  it("flips dflow defaults off in ai mode", () => {
    const route = resolveMagicRouter("swap SOL for USDC", env, "ai");
    expect(route.dflow.spotTradingDefault).toBe(false);
    expect(route.dflow.predictionMarketDefault).toBe(false);
  });

  it("keeps dflow defaults on in trading mode", () => {
    const route = resolveMagicRouter("swap SOL for USDC", env, "trading");
    expect(route.dflow.spotTradingDefault).toBe(true);
    expect(route.dflow.predictionMarketDefault).toBe(true);
  });
});
