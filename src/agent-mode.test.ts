// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_AGENT_MODE,
  FINANCIAL_TOOLS,
  describeAgentMode,
  getAgentMode,
  isAgentMode,
  partitionToolsForMode,
  setAgentMode,
} from "./agent-mode.js";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "nemoclawd-mode-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("isAgentMode", () => {
  it("accepts only 'ai' and 'trading'", () => {
    expect(isAgentMode("ai")).toBe(true);
    expect(isAgentMode("trading")).toBe(true);
    expect(isAgentMode("degen")).toBe(false);
    expect(isAgentMode(undefined)).toBe(false);
  });
});

describe("partitionToolsForMode", () => {
  const toolSet = ["chat", "dflow-order", "solana-rpc", "wallet-approval", "filesystem"];

  it("passes every tool through unchanged in trading mode", () => {
    const { allowed, blocked } = partitionToolsForMode(toolSet, "trading");
    expect(allowed).toEqual(toolSet);
    expect(blocked).toEqual([]);
  });

  it("strips financial tools in ai mode", () => {
    const { allowed, blocked } = partitionToolsForMode(toolSet, "ai");
    expect(allowed).toEqual(["chat", "filesystem"]);
    expect(blocked.sort()).toEqual(["dflow-order", "solana-rpc", "wallet-approval"].sort());
  });

  it("agrees with the FINANCIAL_TOOLS set", () => {
    for (const tool of FINANCIAL_TOOLS) {
      const { blocked } = partitionToolsForMode([tool], "ai");
      expect(blocked).toEqual([tool]);
    }
  });
});

describe("getAgentMode / setAgentMode", () => {
  it("defaults to trading mode when no state exists", () => {
    expect(getAgentMode({ HOME: home })).toBe(DEFAULT_AGENT_MODE);
    expect(getAgentMode({ HOME: home })).toBe("trading");
  });

  it("persists a mode change across reads", () => {
    setAgentMode("ai", { HOME: home });
    expect(getAgentMode({ HOME: home })).toBe("ai");

    setAgentMode("trading", { HOME: home });
    expect(getAgentMode({ HOME: home })).toBe("trading");
  });

  it("throws on an invalid mode", () => {
    expect(() => setAgentMode("degen" as never, { HOME: home })).toThrow(/Invalid agent mode/);
  });

  it("prefers NEMOCLAWD_MODE env override over persisted state", () => {
    setAgentMode("trading", { HOME: home });
    expect(getAgentMode({ HOME: home, NEMOCLAWD_MODE: "ai" })).toBe("ai");
  });

  it("falls back to the default when the state file is corrupt", () => {
    setAgentMode("ai", { HOME: home });
    const statePath = join(home, ".nemoclawd", "mode.json");
    writeFileSync(statePath, "{not json");
    expect(getAgentMode({ HOME: home })).toBe(DEFAULT_AGENT_MODE);
  });
});

describe("describeAgentMode", () => {
  it("describes both modes distinctly", () => {
    expect(describeAgentMode("ai")).toMatch(/disabled/i);
    expect(describeAgentMode("trading")).toMatch(/default/i);
  });
});
