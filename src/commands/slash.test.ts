// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginCommandContext } from "../index.js";

vi.mock("../blueprint/state.js", () => ({
  loadState: vi.fn(() => ({
    lastRunId: null,
    lastAction: null,
    blueprintVersion: null,
    sandboxName: null,
    migrationSnapshot: null,
    hostBackupPath: null,
    createdAt: null,
    updatedAt: new Date().toISOString(),
  })),
}));

vi.mock("../onboard/config.js", () => ({
  loadOnboardConfig: vi.fn(() => null),
}));

let currentMode: "ai" | "trading" = "trading";

vi.mock("../agent-mode.js", () => ({
  AGENT_MODES: ["ai", "trading"],
  isAgentMode: (value: unknown) => value === "ai" || value === "trading",
  getAgentMode: () => currentMode,
  setAgentMode: (mode: "ai" | "trading") => {
    currentMode = mode;
    return mode;
  },
  describeAgentMode: (mode: "ai" | "trading") => `describe:${mode}`,
}));

const { handleSlashCommand } = await import("./slash.js");

function ctx(args: string, isAuthorizedSender: boolean): PluginCommandContext {
  return {
    channel: "test",
    isAuthorizedSender,
    args,
    commandBody: `/nemoclawd ${args}`,
    config: {},
  };
}

beforeEach(() => {
  currentMode = "trading";
});

describe("handleSlashCommand mode gating", () => {
  it("allows an unauthorized sender to read the current mode", () => {
    const result = handleSlashCommand(ctx("mode", false), {} as never);
    expect(result.text).toContain("trading");
    expect(currentMode).toBe("trading");
  });

  it("refuses to change mode for an unauthorized sender and leaves the mode unchanged", () => {
    const result = handleSlashCommand(ctx("mode ai", false), {} as never);
    expect(result.text).toMatch(/authorized sender/i);
    expect(currentMode).toBe("trading");
  });

  it("allows an authorized sender to switch modes", () => {
    const result = handleSlashCommand(ctx("mode ai", true), {} as never);
    expect(result.text).toContain("Agent mode set");
    expect(currentMode).toBe("ai");
  });

  it("rejects an unknown mode target even for an authorized sender", () => {
    const result = handleSlashCommand(ctx("mode bogus", true), {} as never);
    expect(result.text).toMatch(/Unknown mode/);
    expect(currentMode).toBe("trading");
  });
});
