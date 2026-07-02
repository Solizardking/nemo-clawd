export declare const DFLOW_API_KEY_ENV = "DFLOW_API_KEY";
export declare const DFLOW_DEV_TRADE_API_URL = "https://dev-quote-api.dflow.net";
export declare const DFLOW_PROD_TRADE_API_URL = "https://quote-api.dflow.net";
export declare const DFLOW_DEV_TRADE_API_WS_URL = "wss://dev-quote-api.dflow.net";
export declare const DFLOW_PROD_TRADE_API_WS_URL = "wss://quote-api.dflow.net";
export declare const DFLOW_DEV_METADATA_API_URL = "https://dev-prediction-markets-api.dflow.net";
export declare const DFLOW_PROD_METADATA_API_URL = "https://prediction-markets-api.dflow.net";
export declare const DFLOW_DEV_METADATA_API_WS_URL = "wss://dev-prediction-markets-api.dflow.net/api/v1/ws";
export declare const DFLOW_PROD_METADATA_API_WS_URL = "wss://prediction-markets-api.dflow.net/api/v1/ws";
export declare const SOL_MINT = "So11111111111111111111111111111111111111112";
export declare const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
export declare function resolveDflowRouteConfig(env?: EnvLike): DflowRouteConfig;
export declare function dflowAuthHeaders(env?: EnvLike): Record<string, string>;
export declare function describeDflowRouting(config?: DflowRouteConfig): string;
export {};
//# sourceMappingURL=dflow.d.ts.map