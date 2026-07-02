"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliStatus = cliStatus;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_util_1 = require("node:util");
const state_js_1 = require("../blueprint/state.js");
const dflow_js_1 = require("../dflow.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
/**
 * Detect whether the plugin is running inside an OpenShell sandbox.
 * Inside sandboxes the root filesystem is mounted at /sandbox and openshell
 * host commands are not available, so querying `openshell sandbox status`
 * would always fail — producing false-negative "not running" reports.
 */
function isInsideSandbox() {
    return (0, node_fs_1.existsSync)("/sandbox/.nemoclawd") || (0, node_fs_1.existsSync)("/sandbox/.nemoclawd");
}
async function cliStatus(opts) {
    const { json: jsonOutput, logger, pluginConfig } = opts;
    const state = (0, state_js_1.loadState)();
    const sandboxName = state.sandboxName ?? "nemoclawd";
    const insideSandbox = isInsideSandbox();
    const dflow = (0, dflow_js_1.resolveDflowRouteConfig)({
        ...process.env,
        DFLOW_TRADE_API_URL: pluginConfig.dflowTradeApiUrl ?? process.env.DFLOW_TRADE_API_URL,
        DFLOW_TRADE_API_WS_URL: pluginConfig.dflowTradeApiWsUrl ?? process.env.DFLOW_TRADE_API_WS_URL,
        DFLOW_METADATA_API_URL: pluginConfig.dflowMetadataApiUrl ?? process.env.DFLOW_METADATA_API_URL,
        DFLOW_METADATA_API_WS_URL: pluginConfig.dflowMetadataApiWsUrl ?? process.env.DFLOW_METADATA_API_WS_URL,
    });
    const [sandbox, inference] = await Promise.all([
        getSandboxStatus(sandboxName, insideSandbox),
        getInferenceStatus(insideSandbox),
    ]);
    const statusData = {
        nemoclawd: {
            lastAction: state.lastAction,
            lastRunId: state.lastRunId,
            blueprintVersion: state.blueprintVersion,
            sandboxName: state.sandboxName,
            migrationSnapshot: state.migrationSnapshot,
            updatedAt: state.updatedAt,
        },
        sandbox,
        inference,
        routing: {
            spot: {
                provider: dflow.spot.provider,
                endpoint: `${dflow.tradeApiUrl}${dflow.spot.orderEndpoint}`,
                bookStream: `${dflow.tradeApiWsUrl}${dflow.spot.bookStreamEndpoint}`,
                settlementMint: dflow.spot.settlementMint,
            },
            predictions: {
                provider: dflow.predictions.provider,
                metadataEndpoint: dflow.metadataApiUrl,
                orderEndpoint: `${dflow.tradeApiUrl}${dflow.predictions.orderEndpoint}`,
                slippageParam: dflow.predictions.slippageParam,
            },
            mode: dflow.mode,
            apiKeyEnv: dflow.apiKeyEnv,
            usesApiKey: dflow.usesApiKey,
        },
        insideSandbox,
    };
    if (jsonOutput) {
        logger.info(JSON.stringify(statusData, null, 2));
        return;
    }
    logger.info("Nemo Clawd Status");
    logger.info("===============");
    logger.info("");
    if (insideSandbox) {
        logger.info("Context: running inside an active OpenShell sandbox");
        logger.info("  Host sandbox state is not inspectable from inside the sandbox.");
        logger.info("  Run 'openshell sandbox status' on the host for full details.");
        logger.info("");
    }
    logger.info("Plugin State:");
    if (state.lastAction) {
        logger.info(`  Last action:      ${state.lastAction}`);
        logger.info(`  Blueprint:        ${state.blueprintVersion ?? "unknown"}`);
        logger.info(`  Run ID:           ${state.lastRunId ?? "none"}`);
        logger.info(`  Updated:          ${state.updatedAt}`);
    }
    else {
        logger.info("  No operations have been performed yet.");
    }
    logger.info("");
    logger.info("Sandbox:");
    if (sandbox.running) {
        logger.info(`  Name:    ${sandbox.name}`);
        logger.info("  Status:  running");
        logger.info(`  Uptime:  ${sandbox.uptime ?? "unknown"}`);
    }
    else if (sandbox.insideSandbox) {
        logger.info(`  Name:    ${sandbox.name}`);
        logger.info("  Status:  active (inside sandbox)");
        logger.info("  Note:    Cannot query host sandbox state from within the sandbox.");
    }
    else {
        logger.info("  Status:  not running");
    }
    logger.info("");
    logger.info("Inference:");
    if (inference.configured) {
        logger.info(`  Provider:  ${inference.provider ?? "unknown"}`);
        logger.info(`  Model:     ${inference.model ?? "unknown"}`);
        logger.info(`  Endpoint:  ${inference.endpoint ?? "unknown"}`);
    }
    else if (inference.insideSandbox) {
        logger.info("  Status:  unable to query from inside sandbox");
        logger.info("  Note:    Run 'openshell inference get' on the host to check.");
    }
    else {
        logger.info("  Not configured");
    }
    logger.info("");
    logger.info("Trading Routing:");
    logger.info(`  Spot:         ${dflow.tradeApiUrl}${dflow.spot.orderEndpoint}`);
    logger.info(`  Book stream:  ${dflow.tradeApiWsUrl}${dflow.spot.bookStreamEndpoint}`);
    logger.info(`  Predictions:  ${dflow.metadataApiUrl} + ${dflow.tradeApiUrl}${dflow.predictions.orderEndpoint}`);
    logger.info(`  Mode:         ${dflow.mode}${dflow.usesApiKey ? "" : " (DFLOW_API_KEY not set)"}`);
    if (state.migrationSnapshot) {
        logger.info("");
        logger.info("Rollback:");
        logger.info(`  Snapshot:  ${state.migrationSnapshot}`);
        logger.info("  Run 'nemoclawd nemoclawd eject ' to restore host installation.");
    }
}
async function getSandboxStatus(sandboxName, insideSandbox) {
    if (insideSandbox) {
        return { name: sandboxName, running: false, uptime: null, insideSandbox: true };
    }
    try {
        const { stdout } = await execAsync(`openshell sandbox status ${sandboxName} --json`, {
            timeout: 5000,
        });
        const parsed = JSON.parse(stdout);
        return {
            name: sandboxName,
            running: parsed.state === "running",
            uptime: parsed.uptime ?? null,
            insideSandbox: false,
        };
    }
    catch {
        return { name: sandboxName, running: false, uptime: null, insideSandbox: false };
    }
}
async function getInferenceStatus(insideSandbox) {
    if (insideSandbox) {
        return { configured: false, provider: null, model: null, endpoint: null, insideSandbox: true };
    }
    try {
        const { stdout } = await execAsync("openshell inference get --json", {
            timeout: 5000,
        });
        const parsed = JSON.parse(stdout);
        return {
            configured: true,
            provider: parsed.provider ?? null,
            model: parsed.model ?? null,
            endpoint: parsed.endpoint ?? null,
            insideSandbox: false,
        };
    }
    catch {
        return { configured: false, provider: null, model: null, endpoint: null, insideSandbox: false };
    }
}
//# sourceMappingURL=status.js.map