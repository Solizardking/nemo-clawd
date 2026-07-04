// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveMagicRouter, classifyMagicRouterTask } = require("../bin/lib/magic-router");

describe("magic router", () => {
  it("classifies prediction-market tasks before generic trading", () => {
    assert.equal(classifyMagicRouterTask("quote a Kalshi prediction market YES token"), "prediction_market");
  });

  it("uses Ollama-local as the default inference route", () => {
    const route = resolveMagicRouter("debug this TypeScript repo", {});
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/ordlibrary/hauhau-qwen36-onchain");
    assert.equal(route.inference.credentialEnv, "OLLAMA_HOST");
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
    // Ollama remains default, NVIDIA is a fallback
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.inference.model, "hf.co/ordlibrary/hauhau-qwen36-onchain");
    assert.equal(route.fallbacks.length, 2);
    assert.equal(route.fallbacks[1].provider, "nvidia-nim");
    assert.equal(route.fallbacks[1].model, "nvidia/nemotron-3-ultra-550b-a55b");
  });

  it("allows the hosted NVIDIA model to be overridden", () => {
    const route = resolveMagicRouter("debug this repo", {
      NVIDIA_API_KEY: "nv-test",
      NEMOCLAWD_NVIDIA_MODEL: "nvidia/nemotron-3-super-120b-a12b",
    });
    // Ollama remains default, NVIDIA fallback is overridden
    assert.equal(route.inference.provider, "ollama-local");
    assert.equal(route.fallbacks[1].model, "nvidia/nemotron-3-super-120b-a12b");
  });

  it("selects DFlow plus Proof/KYC tools for prediction markets", () => {
    const route = resolveMagicRouter("buy a prediction market outcome token", {});
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
});