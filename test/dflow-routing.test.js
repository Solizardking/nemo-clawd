// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const dflow = require("../bin/lib/dflow");

describe("DFlow routing defaults", () => {
  it("uses developer endpoints when DFLOW_API_KEY is absent", () => {
    const cfg = dflow.resolveDflowRouting({});
    assert.equal(cfg.mode, "development");
    assert.equal(cfg.usesApiKey, false);
    assert.equal(cfg.tradeApiUrl, "https://dev-quote-api.dflow.net");
    assert.equal(cfg.metadataApiUrl, "https://dev-prediction-markets-api.dflow.net");
    assert.equal(cfg.spot.provider, "dflow");
    assert.equal(cfg.spot.orderEndpoint, "/order");
  });

  it("uses production endpoints and x-api-key auth when DFLOW_API_KEY is present", () => {
    const env = { DFLOW_API_KEY: "dflow_test_key" };
    const cfg = dflow.resolveDflowRouting(env);
    assert.equal(cfg.mode, "production");
    assert.equal(cfg.usesApiKey, true);
    assert.equal(cfg.tradeApiUrl, "https://quote-api.dflow.net");
    assert.equal(cfg.metadataApiUrl, "https://prediction-markets-api.dflow.net");
    assert.deepEqual(dflow.dflowAuthHeaders(env), { "x-api-key": "dflow_test_key" });
  });

  it("routes prediction outcome tokens through the trading /order endpoint", () => {
    const cfg = dflow.resolveDflowRouting({ DFLOW_API_KEY: "key" });
    assert.equal(cfg.predictions.provider, "dflow");
    assert.equal(cfg.predictions.orderEndpoint, "/order");
    assert.equal(cfg.predictions.marketSearchEndpoint, "/api/v1/search");
    assert.equal(cfg.predictions.slippageParam, "predictionMarketSlippageBps");
  });

  it("declares DFlow as the plugin default for spot and predictions", () => {
    const manifestPath = path.join(__dirname, "..", "nemoclawd.plugin.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.equal(manifest.configSchema.properties.spotTradingProvider.default, "dflow");
    assert.equal(manifest.configSchema.properties.predictionMarketProvider.default, "dflow");
  });
});
