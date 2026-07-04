// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveMagicRouter, classifyMagicRouterTask } = require("../bin/lib/magic-router");

describe("magic router", () => {
  it("classifies prediction-market tasks before generic trading", () => {
    assert.equal(classifyMagicRouterTask("quote a Kalshi prediction market YES token"), "prediction_market");
  });

  it("keeps ZAI GLM 5.2 as the default when configured", () => {
    const route = resolveMagicRouter("debug this TypeScript repo", {
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
      OPENROUTER_API_KEY: "or-test",
    });
    assert.equal(route.inference.provider, "openrouter");
    assert.equal(route.inference.model, "openrouter/auto");
    assert.equal(route.inference.credentialEnv, "OPENROUTER_API_KEY");
  });

  it("uses hosted Nemotron 3 Ultra for NVIDIA fallback by default", () => {
    const route = resolveMagicRouter("debug this repo", {
      NVIDIA_API_KEY: "nv-test",
    });
    assert.equal(route.inference.provider, "nvidia-nim");
    assert.equal(route.inference.model, "nvidia/nemotron-3-ultra-550b-a55b");
  });

  it("allows the hosted NVIDIA model to be overridden", () => {
    const route = resolveMagicRouter("debug this repo", {
      NVIDIA_API_KEY: "nv-test",
      NEMOCLAWD_NVIDIA_MODEL: "nvidia/nemotron-3-super-120b-a12b",
    });
    assert.equal(route.inference.provider, "nvidia-nim");
    assert.equal(route.inference.model, "nvidia/nemotron-3-super-120b-a12b");
  });

  it("selects DFlow plus Proof/KYC tools for prediction markets", () => {
    const route = resolveMagicRouter("buy a prediction market outcome token", {
      ZAI_API_KEY: "zai-test",
    });
    assert.equal(route.taskType, "prediction_market");
    assert.ok(route.toolSet.includes("dflow-prediction-metadata"));
    assert.ok(route.toolSet.includes("proof-kyc-check"));
    assert.equal(route.dflow.predictionMarketDefault, true);
  });

  it("routes ZK attestation and nullifier tasks to the Clawd ZK tools", () => {
    const route = resolveMagicRouter("derive a nullifier and publish a Groth16 model attestation", {
      ZAI_API_KEY: "zai-test",
    });
    assert.equal(route.taskType, "zk_proof");
    assert.ok(route.toolSet.includes("clawd-zk-agent"));
    assert.ok(route.toolSet.includes("clawd-zk-client"));
    assert.ok(route.toolSet.includes("light-protocol"));
  });
});
