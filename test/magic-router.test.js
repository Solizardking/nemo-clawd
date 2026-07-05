// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveMagicRouter, classifyMagicRouterTask } = require("../bin/lib/magic-router");

// resolveMagicRouter's mode argument now defaults to the persisted agent mode
// (see agent-mode.js getAgentMode). Point every env fixture that omits an
// explicit mode at an isolated, empty HOME so "no mode.json" -> "trading" is
// deterministic and independent of the real machine's ~/.nemoclawd state.
const ISOLATED_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclawd-magic-router-test-"));

describe("magic router", () => {
  it("classifies prediction-market tasks before generic trading", () => {
    assert.equal(classifyMagicRouterTask("quote a Kalshi prediction market YES token"), "prediction_market");
  });

  it("keeps ZAI GLM 5.2 as the default when configured", () => {
    const route = resolveMagicRouter("debug this TypeScript repo", {
      HOME: ISOLATED_HOME,
      ZAI_API_KEY: "zai-test",
      OPENROUTER_API_KEY: "or-test",
      NVIDIA_API_KEY: "nv-test",
    });
    assert.equal(route.inference.provider, "zai-glm");
    assert.equal(route.inference.model, "zai/glm-5.2");
    assert.equal(route.advisor.provider, "openrouter");
    assert.equal(route.advisor.model, "openrouter/auto");
    assert.ok(route.toolSet.includes("openrouter-auto-router"));
  });

  it("uses OpenRouter auto when ZAI is unavailable and OpenRouter is configured", () => {
    const route = resolveMagicRouter("research latest model benchmarks", {
      HOME: ISOLATED_HOME,
      OPENROUTER_API_KEY: "or-test",
    });
    assert.equal(route.inference.provider, "openrouter");
    assert.equal(route.inference.model, "openrouter/auto");
    assert.equal(route.inference.credentialEnv, "OPENROUTER_API_KEY");
  });

  it("selects DFlow plus Proof/KYC tools for prediction markets", () => {
    const route = resolveMagicRouter("buy a prediction market outcome token", {
      HOME: ISOLATED_HOME,
      ZAI_API_KEY: "zai-test",
    });
    assert.equal(route.taskType, "prediction_market");
    assert.ok(route.toolSet.includes("dflow-prediction-metadata"));
    assert.ok(route.toolSet.includes("proof-kyc-check"));
    assert.equal(route.dflow.predictionMarketDefault, true);
  });

  it("defaults to trading mode when no mode argument is passed", () => {
    const route = resolveMagicRouter("check my wallet balance", { HOME: ISOLATED_HOME, ZAI_API_KEY: "zai-test" });
    assert.equal(route.mode, "trading");
    assert.ok(route.toolSet.includes("solana-rpc"));
    assert.deepEqual(route.blockedTools, []);
  });

  it("ai mode strips financial tools even for wallet_ops requests", () => {
    const route = resolveMagicRouter("check my wallet balance", { ZAI_API_KEY: "zai-test" }, "ai");
    assert.equal(route.mode, "ai");
    assert.equal(route.taskType, "wallet_ops");
    assert.ok(!route.toolSet.includes("solana-rpc"));
    assert.ok(!route.toolSet.includes("wallet-approval"));
    assert.ok(!route.toolSet.includes("openshell-private-wallet"));
    assert.ok(route.blockedTools.includes("solana-rpc"));
    assert.ok(route.guardrails.includes("ai-mode-financial-tools-disabled"));
  });

  it("ai mode strips DFlow and KYC tools for prediction markets and flips dflow defaults off", () => {
    const route = resolveMagicRouter("quote a Kalshi prediction market YES token", { ZAI_API_KEY: "zai-test" }, "ai");
    assert.ok(!route.toolSet.includes("dflow-prediction-metadata"));
    assert.ok(!route.toolSet.includes("proof-kyc-check"));
    assert.equal(route.dflow.predictionMarketDefault, false);
    assert.equal(route.dflow.spotTradingDefault, false);
  });

  it("ai mode leaves non-financial tool sets (coding) unchanged", () => {
    const trading = resolveMagicRouter("debug this TypeScript repo", { HOME: ISOLATED_HOME, ZAI_API_KEY: "zai-test" }, "trading");
    const ai = resolveMagicRouter("debug this TypeScript repo", { HOME: ISOLATED_HOME, ZAI_API_KEY: "zai-test" }, "ai");
    assert.deepEqual(ai.toolSet, trading.toolSet);
    assert.deepEqual(ai.blockedTools, []);
  });

  it("resolves the persisted mode when the mode argument is omitted, so old call sites can't bypass AI Mode", () => {
    const { setAgentMode } = require("../bin/lib/mode");
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclawd-magic-router-persisted-"));
    setAgentMode("ai", { HOME: home });

    const route = resolveMagicRouter("check my wallet balance", { HOME: home, ZAI_API_KEY: "zai-test" });
    assert.equal(route.mode, "ai");
    assert.ok(!route.toolSet.includes("solana-rpc"));
    assert.ok(route.blockedTools.includes("solana-rpc"));
  });
});
