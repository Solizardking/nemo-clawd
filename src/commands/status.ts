// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import type { PluginLogger, NemoClawdConfig } from "../index.js";
import { loadState } from "../blueprint/state.js";
import { resolveDflowRouteConfig } from "../dflow.js";

const execAsync = promisify(exec);

/**
 * Detect whether the plugin is running inside an OpenShell sandbox.
 * Inside sandboxes the root filesystem is mounted at /sandbox and openshell
 * host commands are not available, so querying `openshell sandbox status`
 * would always fail — producing false-negative "not running" reports.
 */
function isInsideSandbox(): boolean {
  return existsSync("/sandbox/.nemoclawd") || existsSync("/sandbox/.nemoclawd");
}

export interface StatusOptions {
  json: boolean;
  logger: PluginLogger;
  pluginConfig: NemoClawdConfig;
}

export async function cliStatus(opts: StatusOptions): Promise<void> {
  const { json: jsonOutput, logger, pluginConfig } = opts;
  const state = loadState();
  const sandboxName = state.sandboxName ?? "nemoclawd";
  const insideSandbox = isInsideSandbox();
  const dflow = resolveDflowRouteConfig({
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
  } else {
    logger.info("  No operations have been performed yet.");
  }
  logger.info("");

  logger.info("Sandbox:");
  if (sandbox.running) {
    logger.info(`  Name:    ${sandbox.name}`);
    logger.info("  Status:  running");
    logger.info(`  Uptime:  ${sandbox.uptime ?? "unknown"}`);
  } else if (sandbox.insideSandbox) {
    logger.info(`  Name:    ${sandbox.name}`);
    logger.info("  Status:  active (inside sandbox)");
    logger.info("  Note:    Cannot query host sandbox state from within the sandbox.");
  } else {
    logger.info("  Status:  not running");
  }
  logger.info("");

  logger.info("Inference:");
  if (inference.configured) {
    logger.info(`  Provider:  ${inference.provider ?? "unknown"}`);
    logger.info(`  Model:     ${inference.model ?? "unknown"}`);
    logger.info(`  Endpoint:  ${inference.endpoint ?? "unknown"}`);
  } else if (inference.insideSandbox) {
    logger.info("  Status:  unable to query from inside sandbox");
    logger.info("  Note:    Run 'openshell inference get' on the host to check.");
  } else {
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

interface SandboxStatus {
  name: string;
  running: boolean;
  uptime: string | null;
  insideSandbox: boolean;
}

interface SandboxStatusResponse {
  state?: string;
  uptime?: string;
}

async function getSandboxStatus(sandboxName: string, insideSandbox: boolean): Promise<SandboxStatus> {
  if (insideSandbox) {
    return { name: sandboxName, running: false, uptime: null, insideSandbox: true };
  }
  try {
    const { stdout } = await execAsync(`openshell sandbox status ${sandboxName} --json`, {
      timeout: 5000,
    });
    const parsed = JSON.parse(stdout) as SandboxStatusResponse;
    return {
      name: sandboxName,
      running: parsed.state === "running",
      uptime: parsed.uptime ?? null,
      insideSandbox: false,
    };
  } catch {
    return { name: sandboxName, running: false, uptime: null, insideSandbox: false };
  }
}

interface InferenceStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  endpoint: string | null;
  insideSandbox: boolean;
}

interface InferenceStatusResponse {
  provider?: string;
  model?: string;
  endpoint?: string;
}

async function getInferenceStatus(insideSandbox: boolean): Promise<InferenceStatus> {
  if (insideSandbox) {
    return { configured: false, provider: null, model: null, endpoint: null, insideSandbox: true };
  }
  try {
    const { stdout } = await execAsync("openshell inference get --json", {
      timeout: 5000,
    });
    const parsed = JSON.parse(stdout) as InferenceStatusResponse;
    return {
      configured: true,
      provider: parsed.provider ?? null,
      model: parsed.model ?? null,
      endpoint: parsed.endpoint ?? null,
      insideSandbox: false,
    };
  } catch {
    return { configured: false, provider: null, model: null, endpoint: null, insideSandbox: false };
  }
}
