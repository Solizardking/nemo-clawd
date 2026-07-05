// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  resolveMagicRouter,
  classifyMagicRouterTask,
  classifyMagicRouterTaskWithConfidence,
  describeMagicRouterPretty,
  getTaskCatalog,
} = require("../bin/lib/magic-router");

// resolveMagicRouter's mode argument now defaults to the persisted agent mode
// (see agent-mode.js getAgentMode). Point every env fixture that omits an
// explicit mode at an isolated, empty HOME so "no mode.json" -> "trading" is
// deterministic and independent of the real machine's ~/.nemoclawd state.
const ISOLATED_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclawd-magic-router-test-"));

describe("magic router", () => {
  it("classifies prediction-market tasks before generic trading", () => {
    assert.equal(classifyMagicRouterTask("quote a Kalshi prediction market YES token"), "prediction_market");
  });

  it("classifies prediction market with confidence", () => {
    const result = classifyMagicRouterTaskWithConfidence("buy a Kalshi YES token on the election");
    assert.equal(result.type, "prediction_market");
    assert.ok(result.confidence >= 0.85);
  });

  it("classifies security audit with high confidence", () => {
    const result = classifyMagicRouterTaskWithConfidence("audit this smart contract for vulnerabilities and rug risk");
    assert.equal(result.type, "security_audit");
    assert.ok(result.confidence >= 0.80);
  });

  it("classifies NFT operations", () => {
    assert.equal(classifyMagicRouterTask("check floor price of my NFT collection"), "nft_ops");
    assert.equal(classifyMagicRouterTask("mint a new NFT on Solana"), "nft_ops");
  });

  it("classifies voice tasks", () => {
    assert.equal(classifyMagicRouterTask("transcribe this audio file"), "voice");
    assert.equal(classifyMagicRouterTask("say hello in a voice clone"), "voice");
  });

  it("classifies image generation", () => {
    assert.equal(classifyMagicRouterTask("generate a meme image"), "image_gen");
    assert.equal(classifyMagicRouterTask("draw a Solana-themed logo"), "image_gen");
  });

  it("classifies data analysis", () => {
    assert.equal(classifyMagicRouterTask("analyze my wallet PnL and token metrics"), "data_analysis");
    assert.equal(classifyMagicRouterTask("show me the trend chart"), "data_analysis");
  });

  it("uses Ollama-local as the default inference route", () => {
    const route = resolveMagicRouter("debug this TypeScript repo", {});
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/ordlibrary/hauhau-qwen36-onchain");
    assert.equal(route.inference.credentialEnv, "OLLAMA_HOST");
    assert.equal(route.version, "2.0.0");
  });

  it("honors OLLAMA_MODEL env override", () => {
    const route = resolveMagicRouter("debug this repo", {
      OLLAMA_MODEL: "hf.co/custom/onchain-model",
    });
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/custom/onchain-model");
  });

  it("uses OpenRouter advisor when available alongside Ollama default", () => {
    const route = resolveMagicRouter("research latest model benchmarks", {
      OPENROUTER_API_KEY: "or-test",
    });
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/ordlibrary/hauhau-qwen36-onchain");
    assert.ok(route.advisor);
    assert.equal(route.advisor.provider, "openrouter");
    assert.equal(route.advisor.model, "openrouter/auto");
    assert.ok(route.toolSet.includes("openrouter-auto-router"));
  });

  it("uses hosted Nemotron 3 Ultra when NVIDIA key is the only credential set", () => {
    const route = resolveMagicRouter("debug this repo", {
      NVIDIA_API_KEY: "nv-test",
    });
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/ordlibrary/hauhau-qwen36-onchain");
    assert.equal(route.fallbacks.length, 2);
    assert.equal(route.fallbacks[1].provider, "nvidia-nim");
    assert.equal(route.fallbacks[1].model, "nvidia/nemotron-3-ultra-550b-a55b");
  });

  it("builds task metadata with emoji, latency, confidence", () => {
    const route = resolveMagicRouter("buy a Kalshi YES token", {});
    assert.ok(route.taskMeta);
    assert.ok(route.taskMeta.emoji);
    assert.ok(route.taskMeta.confidence >= 0);
    assert.ok(["fast", "medium", "slow"].includes(route.taskMeta.typical_latency));
  });

  it("pretty-print produces multiline decision trace", () => {
    const route = resolveMagicRouter("generate a meme about Solana", {});
    const pretty = describeMagicRouterPretty(route);
    assert.ok(pretty.includes("Magic Router v2.0.0"));
    assert.ok(pretty.includes("🎨"));
    assert.ok(pretty.includes("Task Classification"));
    assert.ok(pretty.includes("ollama-local"));
    assert.ok(pretty.includes("Guardrails"));
    assert.ok(pretty.includes("DFlow Routing"));
  });

  it("returns full task catalog", () => {
    const catalog = getTaskCatalog();
    assert.ok(catalog.length >= 12);
    const types = catalog.map((c) => c.type);
    assert.ok(types.includes("coding"));
    assert.ok(types.includes("voice"));
    assert.ok(types.includes("image_gen"));
    assert.ok(types.includes("nft_ops"));
    assert.ok(types.includes("security_audit"));
    assert.ok(types.includes("data_analysis"));
  });

  it("selects DFlow plus Proof/KYC tools for prediction markets", () => {
    const route = resolveMagicRouter("buy a prediction market outcome token", { HOME: ISOLATED_HOME });
    assert.equal(route.taskType, "prediction_market");
    assert.ok(route.toolSet.includes("dflow-prediction-metadata"));
    assert.ok(route.toolSet.includes("proof-kyc-check"));
    assert.equal(route.dflow.predictionMarketDefault, true);
  });

  it("routes ZK attestation and nullifier tasks to the Clawd ZK tools", () => {
    const route = resolveMagicRouter("derive a nullifier and publish a Groth16 model attestation", {});
    assert.equal(route.taskType, "zk_proof");
    assert.ok(route.toolSet.includes("clawd-zk-agent"));
    assert.ok(route.toolSet.includes("clawd-zk-client"));
    assert.ok(route.toolSet.includes("light-protocol"));
  });

  it("routes security audit tasks to rug detection tools", () => {
    const route = resolveMagicRouter("audit this token contract for rug risk", {});
    assert.equal(route.taskType, "security_audit");
    assert.ok(route.toolSet.includes("rug-detection"));
    assert.ok(route.toolSet.includes("contract-read"));
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
