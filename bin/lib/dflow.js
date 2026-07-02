// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const DFLOW_API_KEY_ENV = "DFLOW_API_KEY";

const DFLOW_DEV_TRADE_API_URL = "https://dev-quote-api.dflow.net";
const DFLOW_PROD_TRADE_API_URL = "https://quote-api.dflow.net";
const DFLOW_DEV_TRADE_API_WS_URL = "wss://dev-quote-api.dflow.net";
const DFLOW_PROD_TRADE_API_WS_URL = "wss://quote-api.dflow.net";

const DFLOW_DEV_METADATA_API_URL = "https://dev-prediction-markets-api.dflow.net";
const DFLOW_PROD_METADATA_API_URL = "https://prediction-markets-api.dflow.net";
const DFLOW_DEV_METADATA_API_WS_URL = "wss://dev-prediction-markets-api.dflow.net/api/v1/ws";
const DFLOW_PROD_METADATA_API_WS_URL = "wss://prediction-markets-api.dflow.net/api/v1/ws";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function envOrDefault(env, key, defaultValue) {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : defaultValue;
}

function hasDflowApiKey(env = process.env) {
  return Boolean(env[DFLOW_API_KEY_ENV] && String(env[DFLOW_API_KEY_ENV]).trim());
}

function resolveDflowRouting(env = process.env) {
  const usesApiKey = hasDflowApiKey(env);
  const mode = usesApiKey ? "production" : "development";

  return {
    mode,
    apiKeyEnv: DFLOW_API_KEY_ENV,
    usesApiKey,
    tradeApiUrl: envOrDefault(env, "DFLOW_TRADE_API_URL", usesApiKey ? DFLOW_PROD_TRADE_API_URL : DFLOW_DEV_TRADE_API_URL),
    tradeApiWsUrl: envOrDefault(env, "DFLOW_TRADE_API_WS_URL", usesApiKey ? DFLOW_PROD_TRADE_API_WS_URL : DFLOW_DEV_TRADE_API_WS_URL),
    metadataApiUrl: envOrDefault(env, "DFLOW_METADATA_API_URL", usesApiKey ? DFLOW_PROD_METADATA_API_URL : DFLOW_DEV_METADATA_API_URL),
    metadataApiWsUrl: envOrDefault(env, "DFLOW_METADATA_API_WS_URL", usesApiKey ? DFLOW_PROD_METADATA_API_WS_URL : DFLOW_DEV_METADATA_API_WS_URL),
    spot: {
      provider: "dflow",
      baseMint: envOrDefault(env, "DFLOW_BASE_MINT", SOL_MINT),
      settlementMint: envOrDefault(env, "DFLOW_SETTLEMENT_MINT", USDC_MINT),
      orderEndpoint: "/order",
      bookStreamEndpoint: "/book-stream",
      directRoutesOnly: true,
    },
    predictions: {
      provider: "dflow",
      orderEndpoint: "/order",
      marketSearchEndpoint: "/api/v1/search",
      marketsEndpoint: "/api/v1/markets",
      websocketEndpoint: "/api/v1/ws",
      initEndpoint: "/prediction-market-init",
      slippageParam: "predictionMarketSlippageBps",
    },
  };
}

function dflowAuthHeaders(env = process.env) {
  const apiKey = env[DFLOW_API_KEY_ENV] && String(env[DFLOW_API_KEY_ENV]).trim();
  return apiKey ? { "x-api-key": apiKey } : {};
}

function describeDflowRouting(config = resolveDflowRouting()) {
  return `${config.mode}: spot ${config.tradeApiUrl}${config.spot.orderEndpoint}, predictions ${config.metadataApiUrl}`;
}

module.exports = {
  DFLOW_API_KEY_ENV,
  DFLOW_DEV_TRADE_API_URL,
  DFLOW_PROD_TRADE_API_URL,
  DFLOW_DEV_TRADE_API_WS_URL,
  DFLOW_PROD_TRADE_API_WS_URL,
  DFLOW_DEV_METADATA_API_URL,
  DFLOW_PROD_METADATA_API_URL,
  DFLOW_DEV_METADATA_API_WS_URL,
  DFLOW_PROD_METADATA_API_WS_URL,
  SOL_MINT,
  USDC_MINT,
  hasDflowApiKey,
  resolveDflowRouting,
  dflowAuthHeaders,
  describeDflowRouting,
};
