// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mode = require("../bin/lib/mode");

describe("agent mode", () => {
  let home;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclawd-mode-"));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("defaults to trading mode when no state file exists", () => {
    assert.equal(mode.getAgentMode({ HOME: home }), "trading");
  });

  it("persists a mode switch to ai and back to trading", () => {
    mode.setAgentMode("ai", { HOME: home });
    assert.equal(mode.getAgentMode({ HOME: home }), "ai");

    mode.setAgentMode("trading", { HOME: home });
    assert.equal(mode.getAgentMode({ HOME: home }), "trading");
  });

  it("rejects an invalid mode", () => {
    assert.throws(() => mode.setAgentMode("degen", { HOME: home }), /Invalid agent mode/);
  });

  it("NEMOCLAWD_MODE env var overrides persisted state", () => {
    mode.setAgentMode("trading", { HOME: home });
    assert.equal(mode.getAgentMode({ HOME: home, NEMOCLAWD_MODE: "ai" }), "ai");
  });

  it("fails closed on an invalid NEMOCLAWD_MODE instead of silently falling back to trading", () => {
    assert.throws(() => mode.getAgentMode({ HOME: home, NEMOCLAWD_MODE: "AI" }), /Invalid NEMOCLAWD_MODE/);
    assert.throws(() => mode.getAgentMode({ HOME: home, NEMOCLAWD_MODE: "degen" }), /Invalid NEMOCLAWD_MODE/);
  });

  it("ignores an empty NEMOCLAWD_MODE and falls back to persisted/default", () => {
    assert.equal(mode.getAgentMode({ HOME: home, NEMOCLAWD_MODE: "" }), "trading");
  });

  it("partitionToolsForMode strips financial tools only in ai mode", () => {
    const toolSet = ["chat", "dflow-order", "solana-rpc", "filesystem"];
    const trading = mode.partitionToolsForMode(toolSet, "trading");
    assert.deepEqual(trading.allowed, toolSet);
    assert.deepEqual(trading.blocked, []);

    const ai = mode.partitionToolsForMode(toolSet, "ai");
    assert.deepEqual(ai.allowed, ["chat", "filesystem"]);
    assert.deepEqual(ai.blocked.sort(), ["dflow-order", "solana-rpc"].sort());
  });

  it("blocks wallet-capable tools beyond the DFlow/RPC set (keypair generation, on-chain instruction building, NFT minting and marketplaces)", () => {
    const toolSet = ["keypair-gen", "instruction-builder", "nft-mint", "magic-eden-api", "tensor-api", "chat"];
    const { allowed, blocked } = mode.partitionToolsForMode(toolSet, "ai");
    assert.deepEqual(allowed, ["chat"]);
    assert.deepEqual(blocked.sort(), ["instruction-builder", "keypair-gen", "magic-eden-api", "nft-mint", "tensor-api"].sort());
  });
});
