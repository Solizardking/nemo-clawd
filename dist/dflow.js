"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDC_MINT = exports.SOL_MINT = exports.DFLOW_PROD_METADATA_API_WS_URL = exports.DFLOW_DEV_METADATA_API_WS_URL = exports.DFLOW_PROD_METADATA_API_URL = exports.DFLOW_DEV_METADATA_API_URL = exports.DFLOW_PROD_TRADE_API_WS_URL = exports.DFLOW_DEV_TRADE_API_WS_URL = exports.DFLOW_PROD_TRADE_API_URL = exports.DFLOW_DEV_TRADE_API_URL = exports.DFLOW_API_KEY_ENV = void 0;
exports.resolveDflowRouteConfig = resolveDflowRouteConfig;
exports.dflowAuthHeaders = dflowAuthHeaders;
exports.describeDflowRouting = describeDflowRouting;
exports.DFLOW_API_KEY_ENV = "DFLOW_API_KEY";
exports.DFLOW_DEV_TRADE_API_URL = "https://dev-quote-api.dflow.net";
exports.DFLOW_PROD_TRADE_API_URL = "https://quote-api.dflow.net";
exports.DFLOW_DEV_TRADE_API_WS_URL = "wss://dev-quote-api.dflow.net";
exports.DFLOW_PROD_TRADE_API_WS_URL = "wss://quote-api.dflow.net";
exports.DFLOW_DEV_METADATA_API_URL = "https://dev-prediction-markets-api.dflow.net";
exports.DFLOW_PROD_METADATA_API_URL = "https://prediction-markets-api.dflow.net";
exports.DFLOW_DEV_METADATA_API_WS_URL = "wss://dev-prediction-markets-api.dflow.net/api/v1/ws";
exports.DFLOW_PROD_METADATA_API_WS_URL = "wss://prediction-markets-api.dflow.net/api/v1/ws";
exports.SOL_MINT = "So11111111111111111111111111111111111111112";
exports.USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function hasDflowApiKey(env) {
    return Boolean(env[exports.DFLOW_API_KEY_ENV]?.trim());
}
function envOrDefault(env, key, defaultValue) {
    const value = env[key]?.trim();
    return value && value.length > 0 ? value : defaultValue;
}
function resolveDflowRouteConfig(env = process.env) {
    const usesApiKey = hasDflowApiKey(env);
    const mode = usesApiKey ? "production" : "development";
    const tradeApiUrl = envOrDefault(env, "DFLOW_TRADE_API_URL", usesApiKey ? exports.DFLOW_PROD_TRADE_API_URL : exports.DFLOW_DEV_TRADE_API_URL);
    const tradeApiWsUrl = envOrDefault(env, "DFLOW_TRADE_API_WS_URL", usesApiKey ? exports.DFLOW_PROD_TRADE_API_WS_URL : exports.DFLOW_DEV_TRADE_API_WS_URL);
    const metadataApiUrl = envOrDefault(env, "DFLOW_METADATA_API_URL", usesApiKey ? exports.DFLOW_PROD_METADATA_API_URL : exports.DFLOW_DEV_METADATA_API_URL);
    const metadataApiWsUrl = envOrDefault(env, "DFLOW_METADATA_API_WS_URL", usesApiKey ? exports.DFLOW_PROD_METADATA_API_WS_URL : exports.DFLOW_DEV_METADATA_API_WS_URL);
    return {
        mode,
        apiKeyEnv: exports.DFLOW_API_KEY_ENV,
        usesApiKey,
        tradeApiUrl,
        tradeApiWsUrl,
        metadataApiUrl,
        metadataApiWsUrl,
        spot: {
            provider: "dflow",
            baseMint: envOrDefault(env, "DFLOW_BASE_MINT", exports.SOL_MINT),
            settlementMint: envOrDefault(env, "DFLOW_SETTLEMENT_MINT", exports.USDC_MINT),
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
    const apiKey = env[exports.DFLOW_API_KEY_ENV]?.trim();
    return apiKey ? { "x-api-key": apiKey } : {};
}
function describeDflowRouting(config = resolveDflowRouteConfig()) {
    return `${config.mode}: spot ${config.tradeApiUrl}${config.spot.orderEndpoint}, predictions ${config.metadataApiUrl}`;
}
//# sourceMappingURL=dflow.js.map