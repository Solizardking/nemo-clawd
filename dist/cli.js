"use strict";
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCliCommands = registerCliCommands;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const index_js_1 = require("./index.js");
const status_js_1 = require("./commands/status.js");
const migrate_js_1 = require("./commands/migrate.js");
const launch_js_1 = require("./commands/launch.js");
const connect_js_1 = require("./commands/connect.js");
const eject_js_1 = require("./commands/eject.js");
const logs_js_1 = require("./commands/logs.js");
const onboard_js_1 = require("./commands/onboard.js");
const mode_js_1 = require("./commands/mode.js");
function runBundledScript(scriptName, scriptArgs = []) {
    const scriptPath = node_path_1.default.resolve(__dirname, "..", "scripts", scriptName);
    (0, node_child_process_1.execFileSync)("bash", [scriptPath, ...scriptArgs], { stdio: "inherit" });
}
function registerCliCommands(ctx, api) {
    const { program, logger } = ctx;
    const pluginConfig = (0, index_js_1.getPluginConfig)(api);
    const nemoclawd = program.command("nemoclawd").description("Nemo Clawd sandbox management");
    // nemoclawd nemoclawd status
    nemoclawd
        .command("status")
        .description("Show sandbox, blueprint, and inference state")
        .option("--json", "Output as JSON", false)
        .action(async (opts) => {
        await (0, status_js_1.cliStatus)({ json: opts.json, logger, pluginConfig });
    });
    // nemoclawd nemoclawd migrate
    nemoclawd
        .command("migrate")
        .description("Migrate host Nemo Clawd installation into an OpenShell sandbox")
        .option("--dry-run", "Show what would be migrated without making changes", false)
        .option("--profile <profile>", "Blueprint profile to use", "default")
        .option("--skip-backup", "Skip creating a host backup snapshot", false)
        .action(async (opts) => {
        await (0, migrate_js_1.cliMigrate)({
            dryRun: opts.dryRun,
            profile: opts.profile,
            skipBackup: opts.skipBackup,
            logger,
            pluginConfig,
        });
    });
    // nemoclawd nemoclawd launch
    nemoclawd
        .command("launch")
        .description("Fresh setup: bootstrap Nemo Clawd inside OpenShell")
        .option("--force", "Skip ergonomics warning and force plugin-driven bootstrap", false)
        .option("--profile <profile>", "Blueprint profile to use", "default")
        .action(async (opts) => {
        await (0, launch_js_1.cliLaunch)({
            force: opts.force,
            profile: opts.profile,
            logger,
            pluginConfig,
        });
    });
    // nemoclawd nemoclawd connect
    nemoclawd
        .command("connect")
        .description("Open an interactive shell inside the Nemo Clawd sandbox")
        .option("--sandbox <name>", "Sandbox name to connect to", pluginConfig.sandboxName)
        .action(async (opts) => {
        await (0, connect_js_1.cliConnect)({ sandbox: opts.sandbox, logger });
    });
    // nemoclawd nemoclawd logs
    nemoclawd
        .command("logs")
        .description("Stream blueprint execution and sandbox logs")
        .option("-f, --follow", "Follow log output", false)
        .option("-n, --lines <count>", "Number of lines to show", "50")
        .option("--run-id <id>", "Show logs for a specific blueprint run")
        .action(async (opts) => {
        await (0, logs_js_1.cliLogs)({
            follow: opts.follow,
            lines: parseInt(opts.lines, 10),
            runId: opts.runId,
            logger,
            pluginConfig,
        });
    });
    // nemoclawd nemoclawd eject
    nemoclawd
        .command("eject")
        .description("Rollback from OpenShell and restore host installation")
        .option("--run-id <id>", "Specific blueprint run ID to rollback from")
        .option("--confirm", "Skip confirmation prompt", false)
        .action(async (opts) => {
        await (0, eject_js_1.cliEject)({
            runId: opts.runId,
            confirm: opts.confirm,
            logger,
            pluginConfig,
        });
    });
    // nemoclawd nemoclawd mode
    nemoclawd
        .command("mode [target]")
        .description("Show or set the agent mode: 'ai' (chat/coding/research only) or 'trading' (default, full Solana tools)")
        .action(async (target) => {
        await (0, mode_js_1.cliMode)({ set: target, logger });
    });
    // nemoclawd nemoclawd onboard
    nemoclawd
        .command("onboard")
        .description("Interactive setup: configure inference endpoint, credential, and model")
        .option("--api-key <key>", "API key for endpoints that require one (skips prompt)")
        .option("--endpoint <type>", "Endpoint type: build, ncp, nim-local, vllm, ollama, custom (local options are experimental)")
        .option("--ncp-partner <name>", "NCP partner name (when endpoint is ncp)")
        .option("--endpoint-url <url>", "Endpoint URL (for ncp, nim-local, ollama, or custom)")
        .option("--model <model>", "Model ID to use")
        .action(async (opts) => {
        await (0, onboard_js_1.cliOnboard)({
            apiKey: opts.apiKey,
            endpoint: opts.endpoint,
            ncpPartner: opts.ncpPartner,
            endpointUrl: opts.endpointUrl,
            model: opts.model,
            logger,
            pluginConfig,
        });
    });
    // nemoclawd nemoclawd setup-orin-nano
    nemoclawd
        .command("setup-orin-nano")
        .description("Prepare a Jetson Orin Nano host for OpenShell and hosted Nemotron")
        .option("--dry-run", "Print detected host state without changing it", false)
        .option("--smoke-test", "Alias for --dry-run", false)
        .action((opts) => {
        const scriptArgs = opts.dryRun || opts.smokeTest ? ["--dry-run"] : [];
        runBundledScript("setup-orin-nano.sh", scriptArgs);
    });
}
//# sourceMappingURL=cli.js.map