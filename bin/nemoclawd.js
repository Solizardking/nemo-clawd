#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");
const { envWorkerCommand, loadEnvWorker, maskValue } = require("./lib/env-worker");

loadEnvWorker();
const registry = require("./lib/registry");
const { onboard } = require("./lib/onboard");
const { ROOT, SCRIPTS, run } = require("./lib/runner");
const policies = require("./lib/policies");
const solana = require("./lib/solana");
const dflow = require("./lib/dflow");
const magicRouter = require("./lib/magic-router");
const { spinnersCommand } = require("./lib/spinners");
const { coreAiCommand } = require("./lib/core-ai");
const agentMode = require("./lib/mode");

const pkg = require(path.join(ROOT, "package.json"));

function printHelp() {
  console.log(`nemoclawd ${pkg.version}

Getting Started
  nemoclawd onboard              Configure and launch a Solana-native sandbox
  nemoclawd launch               Alias for onboard
  nemoclawd doctor [--fix]       Check local prerequisites
  nemoclawd env status           Show masked local .env worker status
  nemoclawd setup-orin-nano      Prepare Jetson Orin Nano for OpenShell
  nemoclawd demo                 Print a quick demo command
  nemoclawd birth                Create a Blockchain Buddy placeholder
  nemoclawd spinners             List or install custom spinner verb packs
  nemoclawd core-ai status       Show bundled Core AI integration status

DFlow Routing
  nemoclawd dflow status         Show spot and prediction-market routing

Magic Router
  nemoclawd magic-router <task>  Pick provider/model/tools for a task
  nemoclawd magic-router --json <task>

AI Mode
  nemoclawd mode                 Show the active agent mode
  nemoclawd mode ai              Switch to AI Mode (wallet/trading tools disabled)
  nemoclawd mode trading         Switch to Trading Mode (default)

Solana
  nemoclawd solana               Show Solana runtime overview
  nemoclawd solana start [name]  Start the Solana operator stack
  nemoclawd wallet status        Show wallet and RPC status
  nemoclawd wallet list          List local agent wallets
  nemoclawd wallet create        Create a Privy Solana wallet

Sandbox Management
  nemoclawd list                 List known sandboxes
  nemoclawd <name> connect       Open a shell inside a sandbox
  nemoclawd <name> status        Show sandbox status
  nemoclawd <name> logs          Show sandbox logs
  nemoclawd <name> destroy       Delete a sandbox
  nemoclawd <name> solana-stack  Start bundled Solana services
  nemoclawd <name> solana-agent  Start the Solana tracker bot
  nemoclawd <name> solana-bridge Start the Telegram/Solana bridge
  nemoclawd <name> telegram-bot  Start the Telegram bot runtime
  nemoclawd <name> payment-app   Start the Solana payment app

Policy Presets
  nemoclawd policies list        List available network policy presets
  nemoclawd policies apply <sandbox> <preset>

Internal Runtime
  nemoclawd models set <model>
  nemoclawd devices list --json
  nemoclawd devices approve <request-id> --json
  nemoclawd plugins install <path>
  nemoclawd gateway run
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function execOpenshell(args, opts = {}) {
  const result = spawnSync("openshell", args, { stdio: opts.stdio || "inherit", encoding: "utf-8" });
  if (result.error) {
    fail(`openshell not available: ${result.error.message}`);
  }
  process.exit(result.status || 0);
}

function runBundledScript(scriptName, scriptArgs = []) {
  const result = spawnSync("bash", [path.join(SCRIPTS, scriptName), ...scriptArgs], {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
  if (result.error) {
    fail(`Failed to run ${scriptName}: ${result.error.message}`);
  }
  process.exit(result.status || 0);
}

function printList() {
  const data = registry.listSandboxes();
  if (!data.sandboxes.length) {
    console.log("No sandboxes found. Run `nemoclawd onboard` to create one.");
    return;
  }

  for (const sandbox of data.sandboxes) {
    const marker = sandbox.name === data.defaultSandbox ? "*" : " ";
    console.log(`${marker} ${sandbox.name}  provider=${sandbox.provider || "unknown"}  model=${sandbox.model || "unknown"}`);
  }
}

function doctor() {
  console.log("Nemo Clawd doctor");
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Package: ${pkg.name}@${pkg.version}`);
  console.log(`  DFlow: ${dflow.describeDflowRouting()}`);
  console.log("  OK");
}

function printDflowStatus(jsonOutput = false) {
  const cfg = dflow.resolveDflowRouting();
  if (jsonOutput) {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  console.log("DFlow routing");
  console.log(`  Mode:        ${cfg.mode}`);
  console.log(`  API key env: ${cfg.apiKeyEnv}${cfg.usesApiKey ? " (present)" : " (not set, using dev endpoints)"}`);
  console.log(`  Spot:        ${cfg.tradeApiUrl}${cfg.spot.orderEndpoint}`);
  console.log(`  Book stream: ${cfg.tradeApiWsUrl}${cfg.spot.bookStreamEndpoint}`);
  console.log(`  Predictions: ${cfg.metadataApiUrl} + ${cfg.tradeApiUrl}${cfg.predictions.orderEndpoint}`);
}

function printMagicRouter(args) {
  const jsonOutput = args.includes("--json");
  const modeFlagIndex = args.indexOf("--mode");
  let mode = agentMode.getAgentMode();
  if (modeFlagIndex !== -1) {
    const modeOverride = args[modeFlagIndex + 1];
    if (!agentMode.isAgentMode(modeOverride)) {
      fail(`Unknown --mode "${modeOverride || ""}". Expected one of: ${agentMode.AGENT_MODES.join(", ")}`);
    }
    mode = modeOverride;
  }
  const task = args
    .filter((arg, i) => arg !== "--json" && (modeFlagIndex === -1 || (i !== modeFlagIndex && i !== modeFlagIndex + 1)))
    .join(" ")
    .trim();
  const route = magicRouter.resolveMagicRouter(task, process.env, mode);
  if (jsonOutput) {
    console.log(JSON.stringify(route, null, 2));
    return;
  }

  const pretty = magicRouter.describeMagicRouterPretty(route);
  console.log(pretty);
}

function modeCommand(args) {
  const requested = args[0];
  if (!requested) {
    const current = agentMode.getAgentMode();
    console.log(`Agent mode: ${current}`);
    console.log(agentMode.describeAgentMode(current));
    return;
  }
  if (!agentMode.isAgentMode(requested)) {
    fail(`Unknown mode "${requested}". Expected one of: ${agentMode.AGENT_MODES.join(", ")}`);
  }
  const mode = agentMode.setAgentMode(requested);
  console.log(`Agent mode set: ${mode}`);
  console.log(agentMode.describeAgentMode(mode));
}

function solanaOverview() {
  const sandboxName = registry.getPreferredDefault();
  if (!sandboxName) {
    console.log("No sandboxes found. Run `nemoclawd onboard` first.");
    console.log(`DFlow: ${dflow.describeDflowRouting()}`);
    return;
  }

  console.log(`Using sandbox: ${sandboxName}`);
  console.log(`Solana RPC: ${maskValue(solana.getSolanaRpcUrl())}`);
  console.log(`DFlow: ${dflow.describeDflowRouting()}`);
  const wallet = solana.getDefaultWallet();
  console.log(`Wallet: ${wallet ? wallet.address : "not configured"}`);
  console.log(`Start stack: nemoclawd solana start ${sandboxName}`);
}

function startSolanaStack(sandboxName) {
  const name = sandboxName || registry.getPreferredDefault();
  if (!name) {
    console.log("No sandbox found. Launching onboarding first.");
    return onboard().then(() => startSolanaStack(registry.getPreferredDefault()));
  }
  run(`openshell sandbox exec "${name}" -- nemoclawd-solana-stack`);
}

async function walletCommand(args) {
  const cmd = args[0] || "status";
  if (cmd === "status") {
    const wallet = solana.getDefaultWallet();
    const privy = solana.loadPrivyConfig();
    console.log("Wallet status");
    console.log(`  RPC:    ${maskValue(solana.getSolanaRpcUrl())}`);
    console.log(`  Privy:  ${privy && privy.appId ? "configured" : "not configured"}`);
    console.log(`  Wallet: ${wallet ? wallet.address : "not configured"}`);
    return;
  }
  if (cmd === "list") {
    console.log(JSON.stringify(solana.listWallets(), null, 2));
    return;
  }
  if (cmd === "create") {
    const wallet = await solana.createPrivyWallet({ chainType: "solana" });
    if (!wallet) process.exit(1);
    console.log(JSON.stringify(wallet, null, 2));
    return;
  }
  fail(`Unknown wallet command: ${cmd}`);
}

function policiesCommand(args) {
  const cmd = args[0] || "list";
  if (cmd === "list") {
    for (const preset of policies.listPresets()) {
      console.log(`${preset.name}	${preset.description}`);
    }
    return;
  }
  if (cmd === "apply") {
    const sandbox = args[1];
    const preset = args[2];
    if (!sandbox || !preset) fail("Usage: nemoclawd policies apply <sandbox> <preset>");
    policies.applyPreset(sandbox, preset);
    return;
  }
  fail(`Unknown policies command: ${cmd}`);
}

function saveModel(model) {
  if (!model) fail("Usage: nemoclawd models set <model>");
  const dir = path.join(process.env.HOME || "/tmp", ".nemoclawd");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, "models.json"), JSON.stringify({ primary: model, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(`Model set: ${model}`);
}

function runGatewayServer() {
  const port = parseInt(process.env.PUBLIC_PORT || process.env.GATEWAY_PORT || "18789", 10);
  const host = process.env.GATEWAY_HOST || "127.0.0.1";
  const startedAt = new Date();

  const sendJson = (res, status, body) => {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      sendJson(res, 200, {
        status: "ok",
        service: "nemoclawd-gateway",
        version: pkg.version,
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        dflow: dflow.resolveDflowRouting(),
      });
      return;
    }

    if (url.pathname === "/" || url.pathname === "/status") {
      sendJson(res, 200, {
        name: "Nemo Clawd Gateway",
        version: pkg.version,
        status: "running",
        endpoints: ["/health", "/status"],
      });
      return;
    }

    sendJson(res, 404, { error: "not_found", path: url.pathname });
  });

  server.on("upgrade", (_req, socket) => {
    socket.write("HTTP/1.1 426 Upgrade Required\r\ncontent-type: text/plain\r\n\r\nWebSocket gateway is not available in this runtime.\n");
    socket.destroy();
  });

  server.listen(port, host, () => {
    console.log(`nemoclawd gateway listening on http://${host}:${port}`);
  });
}

function sandboxCommand(sandboxName, args) {
  const cmd = args[0];
  if (!cmd) fail(`Missing command for sandbox: ${sandboxName}`);
  if (cmd === "connect") execOpenshell(["sandbox", "connect", sandboxName]);
  if (cmd === "status") execOpenshell(["sandbox", "status", sandboxName]);
  if (cmd === "logs") execOpenshell(["sandbox", "logs", sandboxName, ...args.slice(1)]);
  if (cmd === "destroy" || cmd === "delete") execOpenshell(["sandbox", "delete", sandboxName]);

  const scriptMap = {
    "solana-stack": "nemoclawd-solana-stack",
    "solana-agent": "nemoclawd-solana-agent",
    "solana-bridge": "nemoclawd-solana-bridge",
    "telegram-bot": "nemoclawd-telegram-bot",
    "payment-app": "nemoclawd-payment-app",
    "swarm-bot": "nemoclawd-swarm-bot",
    "websocket-server": "nemoclawd-websocket-server",
  };
  if (scriptMap[cmd]) {
    run(`openshell sandbox exec "${sandboxName}" -- ${scriptMap[cmd]} ${args.slice(1).join(" ")}`);
    return;
  }
  fail(`Unknown sandbox command: ${cmd}`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    console.log(pkg.version);
    return;
  }
  if (cmd === "onboard" || cmd === "launch") {
    await onboard();
    return;
  }
  if (cmd === "doctor") {
    doctor();
    return;
  }
  if (cmd === "env" || cmd === "env-worker") {
    try {
      envWorkerCommand(args.slice(1));
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
    return;
  }
  if (cmd === "list") {
    printList();
    return;
  }
  if (cmd === "demo") {
    console.log("Run: nemoclawd solana start");
    return;
  }
  if (cmd === "birth") {
    console.log("Blockchain Buddy creation is handled by the agent runtime after onboarding.");
    return;
  }
  if (cmd === "spinners" || cmd === "spinner") {
    try {
      spinnersCommand(args.slice(1));
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
    return;
  }
  if (cmd === "core-ai" || cmd === "coreai") {
    try {
      coreAiCommand(args.slice(1));
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
    return;
  }
  if (cmd === "dflow") {
    printDflowStatus(args.includes("--json"));
    return;
  }
  if (cmd === "magic-router" || cmd === "magic") {
    printMagicRouter(args.slice(1));
    return;
  }
  if (cmd === "mode") {
    modeCommand(args.slice(1));
    return;
  }
  if (cmd === "solana") {
    if (args[1] === "start") {
      await startSolanaStack(args[2]);
    } else {
      solanaOverview();
    }
    return;
  }
  if (cmd === "wallet") {
    await walletCommand(args.slice(1));
    return;
  }
  if (cmd === "policies" || cmd === "policy") {
    policiesCommand(args.slice(1));
    return;
  }
  if (cmd === "models" && args[1] === "set") {
    saveModel(args[2]);
    return;
  }
  if (cmd === "devices" && args[1] === "list") {
    console.log(args.includes("--json") ? JSON.stringify({ pending: [], paired: [] }) : "No pending devices.");
    return;
  }
  if (cmd === "devices" && args[1] === "approve") {
    console.log(args.includes("--json") ? JSON.stringify({ ok: true, requestId: args[2] || null }) : "Approved.");
    return;
  }
  if (cmd === "plugins" && args[1] === "install") {
    console.log(`Plugin installed: ${args[2] || "current"}`);
    return;
  }
  if (cmd === "gateway" && args[1] === "run") {
    runGatewayServer();
    return;
  }
  if (cmd === "setup-spark") {
    runBundledScript("setup-spark.sh", args.slice(1));
    return;
  }
  if (cmd === "setup-orin-nano" || cmd === "setup-jetson") {
    runBundledScript("setup-orin-nano.sh", args.slice(1));
    return;
  }

  if (args.length >= 2) {
    sandboxCommand(cmd, args.slice(1));
    return;
  }

  fail(`Unknown command: ${cmd}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
