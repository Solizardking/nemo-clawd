#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const registry = require("./lib/registry");
const { onboard } = require("./lib/onboard");
const { ROOT, SCRIPTS, run } = require("./lib/runner");
const policies = require("./lib/policies");
const solana = require("./lib/solana");
const dflow = require("./lib/dflow");
const magicRouter = require("./lib/magic-router");

const pkg = require(path.join(ROOT, "package.json"));

function printHelp() {
  console.log(`nemoclawd ${pkg.version}

Getting Started
  nemoclawd onboard              Configure and launch a Solana-native sandbox
  nemoclawd launch               Alias for onboard
  nemoclawd doctor [--fix]       Check local prerequisites
  nemoclawd demo                 Print a quick demo command
  nemoclawd birth                Create a Blockchain Buddy placeholder

DFlow Routing
  nemoclawd dflow status         Show spot and prediction-market routing

Magic Router
  nemoclawd magic-router <task>  Pick provider/model/tools for a task
  nemoclawd magic-router --json <task>

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
  const task = args.filter((arg) => arg !== "--json").join(" ").trim();
  const route = magicRouter.resolveMagicRouter(task, process.env);
  if (jsonOutput) {
    console.log(JSON.stringify(route, null, 2));
    return;
  }

  console.log("Magic Router");
  console.log(`  Task:      ${route.taskType}`);
  console.log(`  Inference: ${route.inference.provider} / ${route.inference.model}`);
  console.log(`  Key env:   ${route.inference.credentialEnv}${route.inference.available ? " (present)" : " (not set)"}`);
  if (route.advisor) {
    console.log(`  Advisor:   ${route.advisor.provider} / ${route.advisor.model}${route.advisor.available ? " (present)" : " (not set)"}`);
  }
  console.log(`  Tools:     ${route.toolSet.join(", ")}`);
  console.log(`  DFlow:     spot=${route.dflow.spotTradingDefault} predictions=${route.dflow.predictionMarketDefault}`);
}

function solanaOverview() {
  const sandboxName = registry.getPreferredDefault();
  if (!sandboxName) {
    console.log("No sandboxes found. Run `nemoclawd onboard` first.");
    console.log(`DFlow: ${dflow.describeDflowRouting()}`);
    return;
  }

  console.log(`Using sandbox: ${sandboxName}`);
  console.log(`Solana RPC: ${solana.getSolanaRpcUrl()}`);
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
    console.log(`  RPC:    ${solana.getSolanaRpcUrl()}`);
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
  if (cmd === "dflow") {
    printDflowStatus(args.includes("--json"));
    return;
  }
  if (cmd === "magic-router" || cmd === "magic") {
    printMagicRouter(args.slice(1));
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
    console.log("nemoclawd gateway placeholder running");
    setInterval(() => {}, 1 << 30);
    return;
  }
  if (cmd === "setup-spark") {
    run(`bash "${path.join(SCRIPTS, "setup-spark.sh")}"`);
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
