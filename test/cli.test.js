// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const CLI = path.join(__dirname, "..", "bin", "nemoclawd.js");

function run(args) {
  try {
    const out = execSync(`node "${CLI}" ${args}`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: "/tmp/nemoclawd-cli-test-" + Date.now() },
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: (err.stdout || "") + (err.stderr || "") };
  }
}

describe("CLI dispatch", () => {
  it("help exits 0 and shows sections", () => {
    const r = run("help");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Getting Started"), "missing Getting Started section");
    assert.ok(r.out.includes("Sandbox Management"), "missing Sandbox Management section");
    assert.ok(r.out.includes("Policy Presets"), "missing Policy Presets section");
    assert.ok(r.out.includes("doctor"), "missing doctor command");
    assert.ok(r.out.includes("env status"), "missing env status command");
    assert.ok(r.out.includes("launch"), "missing launch command");
    assert.ok(r.out.includes("setup-orin-nano"), "missing Orin Nano setup command");
    assert.ok(r.out.includes("spinners"), "missing spinners command");
    assert.ok(r.out.includes("core-ai status"), "missing Core AI command");
    assert.ok(r.out.includes("solana-agent"), "missing Solana agent action");
    assert.ok(r.out.includes("solana-bridge"), "missing Solana bridge action");
    assert.ok(r.out.includes("solana start"), "missing Solana one-shot action");
    assert.ok(r.out.includes("telegram-bot"), "missing Telegram bot action");
    assert.ok(r.out.includes("payment-app"), "missing payment app action");
  });

  it("--help exits 0", () => {
    assert.equal(run("--help").code, 0);
  });

  it("setup-orin-nano --dry-run exits 0", () => {
    const r = run("setup-orin-nano --dry-run");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Dry run"), r.out);
    assert.ok(r.out.includes("setup is only for Jetson Orin Nano Linux hosts") || r.out.includes("Host:"), r.out);
  });

  it("-h exits 0", () => {
    assert.equal(run("-h").code, 0);
  });

  it("no args exits 0 (shows help)", () => {
    const r = run("");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("nemoclawd"));
  });

  it("unknown command exits 1", () => {
    const r = run("boguscmd");
    assert.equal(r.code, 1);
    assert.ok(r.out.includes("Unknown command"));
  });

  it("list exits 0", () => {
    const r = run("list");
    assert.equal(r.code, 0);
    // With empty HOME, should say no sandboxes
    assert.ok(r.out.includes("No sandboxes"));
  });

  it("version exits 0 and shows package version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    const r = run("version");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes(pkg.version), "missing CLI version");
  });

  it("core-ai status exits 0 and reports imported package count", () => {
    const r = run("core-ai status");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Core AI bundle"), r.out);
    assert.ok(r.out.includes("Packages:"), r.out);
    assert.ok(r.out.includes("core-ai"), r.out);
  });

  it("core-ai package shows commands for a known package", () => {
    const r = run("core-ai package helius-mcp");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Helius MCP"), r.out);
    assert.ok(r.out.includes("core-ai:helius-mcp:build"), r.out);
  });

  it("core-ai packages --json prints package metadata", () => {
    const r = run("core-ai packages --json");
    assert.equal(r.code, 0);
    const packages = JSON.parse(r.out);
    assert.ok(packages.some((pkg) => pkg.id === "clawd-code"), r.out);
    assert.ok(packages.every((pkg) => Object.prototype.hasOwnProperty.call(pkg, "exists")), r.out);
  });

  it("spinners list shows bundled packs", () => {
    const r = run("spinners list");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("developer"), r.out);
    assert.ok(!r.out.includes("metadata.json"), r.out);
  });

  it("spinners install writes only spinnerVerbs into settings", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const settings = path.join(home, ".clawd", "settings.json");
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, JSON.stringify({ existing: true, spinnerVerbs: { verbs: ["old"] } }, null, 2));

    const install = execSync(`node "${CLI}" spinners install developer --settings "${settings}"`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });
    assert.ok(install.includes('Spinner pack "developer" installed successfully.'), install);

    const updated = JSON.parse(fs.readFileSync(settings, "utf-8"));
    assert.equal(updated.existing, true);
    assert.equal(updated.spinnerVerbs.mode, "replace");
    assert.ok(updated.spinnerVerbs.verbs.includes("Reading the docs for once"));
  });

  it("spinners remove deletes only spinnerVerbs", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const settings = path.join(home, ".clawd", "settings.json");
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, JSON.stringify({ existing: true, spinnerVerbs: { verbs: ["old"] } }, null, 2));

    const removed = execSync(`node "${CLI}" spinners remove --settings "${settings}"`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });
    assert.ok(removed.includes("Spinner pack removed."), removed);

    const updated = JSON.parse(fs.readFileSync(settings, "utf-8"));
    assert.deepEqual(updated, { existing: true });
  });

  it("env status loads local env file and masks secrets", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const envDir = path.join(home, ".nemoclawd");
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(
      path.join(envDir, ".env"),
      [
        "HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=test-secret-key",
        "NOVITA_API_KEY=sk_test_secret",
      ].join("\n"),
    );

    const out = execSync(`node "${CLI}" env status`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });

    assert.ok(out.includes("HELIUS_RPC_URL"), out);
    assert.ok(out.includes("api-key=****"), out);
    assert.ok(!out.includes("test-secret-key"), out);
    assert.ok(!out.includes("sk_test_secret"), out);
  });

  it("wallet status uses env worker RPC and masks URL credentials", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const envDir = path.join(home, ".nemoclawd");
    fs.mkdirSync(envDir, { recursive: true });
    fs.writeFileSync(path.join(envDir, ".env"), "HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=test-secret-key\n");

    const out = execSync(`node "${CLI}" wallet status`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });

    assert.ok(out.includes("https://mainnet.helius-rpc.com/"), out);
    assert.ok(out.includes("api-key=****"), out);
    assert.ok(!out.includes("test-secret-key"), out);
  });

  it("solana overview prefers active gateway last sandbox over first registry entry", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const sandboxDir = path.join(home, ".nemoclawd");
    const openshellDir = path.join(home, ".config", "openshell", "gateways", "nemoclawd");
    fs.mkdirSync(sandboxDir, { recursive: true });
    fs.mkdirSync(openshellDir, { recursive: true });
    fs.writeFileSync(
      path.join(sandboxDir, "sandboxes.json"),
      JSON.stringify({
        sandboxes: {
          "my-assistant": { name: "my-assistant", model: "old-model", provider: "ollama-local", gpuEnabled: true, policies: [] },
          "nemo": { name: "nemo", model: "8bit/DeepSolana", provider: "ollama-local", gpuEnabled: true, policies: [] },
        },
        defaultSandbox: "my-assistant",
      }),
    );
    fs.mkdirSync(path.join(home, ".config", "openshell"), { recursive: true });
    fs.writeFileSync(path.join(home, ".config", "openshell", "active_gateway"), "nemoclawd\n");
    fs.writeFileSync(path.join(openshellDir, "last_sandbox"), "nemo\n");

    const out = execSync(`node "${CLI}" solana`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });

    assert.ok(out.includes("Using sandbox: nemo"), out);
    assert.ok(!out.includes("Using sandbox: my-assistant"), out);
  });

  it("mode defaults to trading and help lists the AI Mode section", () => {
    const r = run("mode");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Agent mode: trading"));

    const help = run("help");
    assert.ok(help.out.includes("AI Mode"), "missing AI Mode help section");
    assert.ok(help.out.includes("nemoclawd mode ai"), "missing mode ai help line");
  });

  it("mode ai persists across invocations sharing the same HOME", () => {
    const home = "/tmp/nemoclawd-cli-test-" + Date.now();
    const opts = { encoding: "utf-8", timeout: 10000, env: { ...process.env, HOME: home } };

    const set = execSync(`node "${CLI}" mode ai`, opts);
    assert.ok(set.includes("Agent mode set: ai"));

    const get = execSync(`node "${CLI}" mode`, opts);
    assert.ok(get.includes("Agent mode: ai"));
  });

  it("mode rejects an unknown target", () => {
    const r = run("mode bogus");
    assert.equal(r.code, 1);
    assert.ok(r.out.includes("Unknown mode"));
  });

  it("magic-router --mode ai strips wallet tools for a wallet_ops task, --mode trading does not", () => {
    const opts = { encoding: "utf-8", timeout: 10000, env: { ...process.env, HOME: "/tmp/nemoclawd-cli-test-" + Date.now(), ZAI_API_KEY: "zai-test" } };

    const ai = execSync(`node "${CLI}" magic-router --mode ai check my wallet balance`, opts);
    assert.ok(ai.includes("Mode: ai"));
    assert.ok(ai.includes("Wallet Operations"));
    assert.ok(ai.includes("Blocked by AI Mode"), ai);
    assert.ok(ai.includes("openshell-private-wallet"), ai);
    assert.ok(ai.includes("solana-rpc"), ai);
    assert.ok(ai.includes("wallet-approval"), ai);

    const trading = execSync(`node "${CLI}" magic-router --mode trading check my wallet balance`, opts);
    assert.ok(trading.includes("Mode: trading"));
    assert.ok(trading.includes("solana-rpc"), trading);
    assert.ok(!trading.includes("Blocked by AI Mode"), trading);
  });

  it("magic-router --mode with a typo'd value fails instead of silently falling back to an unsafe route", () => {
    const r = run(`magic-router --mode aii check my wallet balance`);
    assert.equal(r.code, 1);
    assert.ok(/Unknown --mode/.test(r.out), r.out);
    assert.ok(!r.out.includes("solana-rpc"), r.out);
  });

  it("magic-router --mode with no value after it fails instead of falling back", () => {
    const r = run(`magic-router --mode`);
    assert.equal(r.code, 1);
    assert.ok(/Unknown --mode/.test(r.out), r.out);
  });
});
