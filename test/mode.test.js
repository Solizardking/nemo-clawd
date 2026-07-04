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

  it("partitionToolsForMode strips financial tools only in ai mode", () => {
    const toolSet = ["chat", "dflow-order", "solana-rpc", "filesystem"];
    const trading = mode.partitionToolsForMode(toolSet, "trading");
    assert.deepEqual(trading.allowed, toolSet);
    assert.deepEqual(trading.blocked, []);

    const ai = mode.partitionToolsForMode(toolSet, "ai");
    assert.deepEqual(ai.allowed, ["chat", "filesystem"]);
    assert.deepEqual(ai.blocked.sort(), ["dflow-order", "solana-rpc"].sort());
  });
});
