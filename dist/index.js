"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPluginConfig = getPluginConfig;
exports.default = register;
const cli_js_1 = require("./cli.js");
const slash_js_1 = require("./commands/slash.js");
const config_js_1 = require("./onboard/config.js");
const dflow_js_1 = require("./dflow.js");
const DEFAULT_PLUGIN_CONFIG = {
    blueprintVersion: "latest",
    blueprintRegistry: "ghcr.io/nvidia/nemoclawd-blueprint",
    sandboxName: "nemoclawd",
    inferenceProvider: "nvidia",
    spotTradingProvider: "dflow",
    predictionMarketProvider: "dflow",
};
function readString(raw, key, fallback) {
    return typeof raw[key] === "string" ? raw[key] : fallback;
}
function getPluginConfig(api) {
    const raw = api.pluginConfig ?? {};
    return {
        blueprintVersion: readString(raw, "blueprintVersion", DEFAULT_PLUGIN_CONFIG.blueprintVersion),
        blueprintRegistry: readString(raw, "blueprintRegistry", DEFAULT_PLUGIN_CONFIG.blueprintRegistry),
        sandboxName: readString(raw, "sandboxName", DEFAULT_PLUGIN_CONFIG.sandboxName),
        inferenceProvider: readString(raw, "inferenceProvider", DEFAULT_PLUGIN_CONFIG.inferenceProvider),
        spotTradingProvider: readString(raw, "spotTradingProvider", DEFAULT_PLUGIN_CONFIG.spotTradingProvider),
        predictionMarketProvider: readString(raw, "predictionMarketProvider", DEFAULT_PLUGIN_CONFIG.predictionMarketProvider),
        dflowTradeApiUrl: readString(raw, "dflowTradeApiUrl"),
        dflowTradeApiWsUrl: readString(raw, "dflowTradeApiWsUrl"),
        dflowMetadataApiUrl: readString(raw, "dflowMetadataApiUrl"),
        dflowMetadataApiWsUrl: readString(raw, "dflowMetadataApiWsUrl"),
    };
}
function getDflowEnv(config) {
    return {
        ...process.env,
        DFLOW_TRADE_API_URL: config.dflowTradeApiUrl ?? process.env.DFLOW_TRADE_API_URL,
        DFLOW_TRADE_API_WS_URL: config.dflowTradeApiWsUrl ?? process.env.DFLOW_TRADE_API_WS_URL,
        DFLOW_METADATA_API_URL: config.dflowMetadataApiUrl ?? process.env.DFLOW_METADATA_API_URL,
        DFLOW_METADATA_API_WS_URL: config.dflowMetadataApiWsUrl ?? process.env.DFLOW_METADATA_API_WS_URL,
    };
}
// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------
function register(api) {
    const pluginConfig = getPluginConfig(api);
    const dflowRoutes = (0, dflow_js_1.resolveDflowRouteConfig)(getDflowEnv(pluginConfig));
    // 1. Register /nemoclawd slash command (chat interface)
    api.registerCommand({
        name: "nemoclawd",
        description: "Nemo Clawd sandbox management (status, eject).",
        acceptsArgs: true,
        handler: (ctx) => (0, slash_js_1.handleSlashCommand)(ctx, api),
    });
    // 2. Register `nemoclawd nemoclawd` CLI subcommands (commander.js)
    api.registerCli((cliCtx) => {
        (0, cli_js_1.registerCliCommands)(cliCtx, api);
    }, { commands: ["nemoclawd"] });
    // 3. Register nvidia-nim provider — use onboard config if available
    const onboardCfg = (0, config_js_1.loadOnboardConfig)();
    const providerCredentialEnv = onboardCfg?.credentialEnv ?? "NVIDIA_API_KEY";
    const providerLabel = onboardCfg
        ? `NVIDIA NIM (${onboardCfg.endpointType}${onboardCfg.ncpPartner ? ` - ${onboardCfg.ncpPartner}` : ""})`
        : "NVIDIA NIM (build.nvidia.com)";
    api.registerProvider({
        id: "nvidia-nim",
        label: providerLabel,
        docsPath: "https://build.nvidia.com/docs",
        aliases: ["nvidia", "nim"],
        envVars: [providerCredentialEnv],
        models: {
            chat: [
                {
                    id: "nvidia/nemotron-3-super-120b-a12b",
                    label: "Nemotron 3 Super 120B (March 2026)",
                    contextWindow: 131072,
                    maxOutput: 8192,
                },
                {
                    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
                    label: "Nemotron Ultra 253B",
                    contextWindow: 131072,
                    maxOutput: 4096,
                },
                {
                    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
                    label: "Nemotron Super 49B v1.5",
                    contextWindow: 131072,
                    maxOutput: 4096,
                },
                {
                    id: "nvidia/nemotron-3-nano-30b-a3b",
                    label: "Nemotron 3 Nano 30B",
                    contextWindow: 131072,
                    maxOutput: 4096,
                },
            ],
        },
        auth: [
            {
                type: "bearer",
                envVar: providerCredentialEnv,
                headerName: "Authorization",
                label: `NVIDIA API Key (${providerCredentialEnv})`,
            },
        ],
    });
    api.registerProvider({
        id: "dflow",
        label: `DFlow Spot + Predictions (${dflowRoutes.mode})`,
        docsPath: "https://pond.dflow.net",
        aliases: ["dflow", "spot", "trading", "predictions", "prediction-markets"],
        envVars: [
            dflow_js_1.DFLOW_API_KEY_ENV,
            "DFLOW_TRADE_API_URL",
            "DFLOW_TRADE_API_WS_URL",
            "DFLOW_METADATA_API_URL",
            "DFLOW_METADATA_API_WS_URL",
        ],
        auth: [
            {
                type: "api-key",
                envVar: dflow_js_1.DFLOW_API_KEY_ENV,
                headerName: "x-api-key",
                label: "DFlow API Key (DFLOW_API_KEY)",
            },
        ],
    });
    api.registerService({
        id: "dflow-routing",
        start: ({ logger }) => {
            logger.info(`DFlow routing default: ${(0, dflow_js_1.describeDflowRouting)(dflowRoutes)}`);
        },
    });
    const bannerEndpoint = onboardCfg?.endpointType ?? "build.nvidia.com";
    const bannerModel = onboardCfg?.model ?? "nvidia/nemotron-3-super-120b-a12b";
    const bannerTrading = `dflow ${dflowRoutes.mode}`;
    api.logger.info("");
    api.logger.info("  ┌─────────────────────────────────────────────────────┐");
    api.logger.info("  │  Nemo Clawd registered                                │");
    api.logger.info("  │                                                     │");
    api.logger.info(`  │  Endpoint:  ${bannerEndpoint.padEnd(40)}│`);
    api.logger.info(`  │  Model:     ${bannerModel.padEnd(40)}│`);
    api.logger.info(`  │  Trading:   ${bannerTrading.padEnd(40)}│`);
    api.logger.info("  │  Commands:  nemoclawd nemoclawd <command>             │");
    api.logger.info("  └─────────────────────────────────────────────────────┘");
    api.logger.info("");
}
//# sourceMappingURL=index.js.map