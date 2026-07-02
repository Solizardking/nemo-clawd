// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const DFLOW_API_KEY_ENV = "DFLOW_API_KEY";

export const DFLOW_DEV_TRADE_API_URL = "https://dev-quote-api.dflow.net";
export const DFLOW_PROD_TRADE_API_URL = "https://quote-api.dflow.net";
export const DFLOW_DEV_TRADE_API_WS_URL = "wss://dev-quote-api.dflow.net";
export const DFLOW_PROD_TRADE_API_WS_URL = "wss://quote-api.dflow.net";

export const DFLOW_DEV_METADATA_API_URL = "https://dev-prediction-markets-api.dflow.net";
export const DFLOW_PROD_METADATA_API_URL = "https://prediction-markets-api.dflow.net";
export const DFLOW_DEV_METADATA_API_WS_URL = "wss://dev-prediction-markets-api.dflow.net/api/v1/ws";
export const DFLOW_PROD_METADATA_API_WS_URL = "wss://prediction-markets-api.dflow.net/api/v1/ws";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type DflowRouteMode = "production" | "development";

export interface DflowSpotRouting {
  provider: "dflow";
  baseMint: string;
  settlementMint: string;
  orderEndpoint: "/order";
  bookStreamEndpoint: "/book-stream";
  directRoutesOnly: boolean;
}

export interface DflowPredictionRouting {
  provider: "dflow";
  orderEndpoint: "/order";
  marketSearchEndpoint: "/api/v1/search";
  marketsEndpoint: "/api/v1/markets";
  websocketEndpoint: "/api/v1/ws";
  initEndpoint: "/prediction-market-init";
  slippageParam: "predictionMarketSlippageBps";
}

export interface DflowRouteConfig {
  mode: DflowRouteMode;
  apiKeyEnv: typeof DFLOW_API_KEY_ENV;
  usesApiKey: boolean;
  tradeApiUrl: string;
  tradeApiWsUrl: string;
  metadataApiUrl: string;
  metadataApiWsUrl: string;
  spot: DflowSpotRouting;
  predictions: DflowPredictionRouting;
}

type EnvLike = Record<string, string | undefined>;

function hasDflowApiKey(env: EnvLike): boolean {
  return Boolean(env[DFLOW_API_KEY_ENV]?.trim());
}

function envOrDefault(env: EnvLike, key: string, defaultValue: string): string {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : defaultValue;
}

export function resolveDflowRouteConfig(env: EnvLike = process.env): DflowRouteConfig {
  const usesApiKey = hasDflowApiKey(env);
  const mode: DflowRouteMode = usesApiKey ? "production" : "development";

  const tradeApiUrl = envOrDefault(
    env,
    "DFLOW_TRADE_API_URL",
    usesApiKey ? DFLOW_PROD_TRADE_API_URL : DFLOW_DEV_TRADE_API_URL,
  );
  const tradeApiWsUrl = envOrDefault(
    env,
    "DFLOW_TRADE_API_WS_URL",
    usesApiKey ? DFLOW_PROD_TRADE_API_WS_URL : DFLOW_DEV_TRADE_API_WS_URL,
  );
  const metadataApiUrl = envOrDefault(
    env,
    "DFLOW_METADATA_API_URL",
    usesApiKey ? DFLOW_PROD_METADATA_API_URL : DFLOW_DEV_METADATA_API_URL,
  );
  const metadataApiWsUrl = envOrDefault(
    env,
    "DFLOW_METADATA_API_WS_URL",
    usesApiKey ? DFLOW_PROD_METADATA_API_WS_URL : DFLOW_DEV_METADATA_API_WS_URL,
  );

  return {
    mode,
    apiKeyEnv: DFLOW_API_KEY_ENV,
    usesApiKey,
    tradeApiUrl,
    tradeApiWsUrl,
    metadataApiUrl,
    metadataApiWsUrl,
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

export function dflowAuthHeaders(env: EnvLike = process.env): Record<string, string> {
  const apiKey = env[DFLOW_API_KEY_ENV]?.trim();
  return apiKey ? { "x-api-key": apiKey } : {};
}

export function describeDflowRouting(config: DflowRouteConfig = resolveDflowRouteConfig()): string {
  return `${config.mode}: spot ${config.tradeApiUrl}${config.spot.orderEndpoint}, predictions ${config.metadataApiUrl}`;
}
