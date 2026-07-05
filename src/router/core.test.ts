// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { classifyTask, createRouter, partitionByCategories, type TaskClassifier } from "./core.js";

// A deliberately non-Solana dummy agent config, to prove the engine carries
// no domain knowledge: task types are shell-agent concepts, and the
// sensitive category is "destructive" (rm -rf, force-push) rather than
// "financial".
type DummyTaskType = "destructive_shell" | "read_only_shell" | "chat";
type DummyMode = "supervised" | "autonomous";

const classifiers: TaskClassifier<DummyTaskType>[] = [
  { taskType: "destructive_shell", test: (text) => /\b(rm -rf|force-push|drop table)\b/.test(text) },
  { taskType: "read_only_shell", test: (text) => /\b(ls|cat|grep)\b/.test(text) },
];

describe("classifyTask", () => {
  it("evaluates classifiers in order and returns the first match", () => {
    expect(classifyTask("rm -rf /tmp/foo", classifiers, "chat")).toBe("destructive_shell");
    expect(classifyTask("ls -la", classifiers, "chat")).toBe("read_only_shell");
  });

  it("falls back to the default task type when nothing matches", () => {
    expect(classifyTask("what's the weather", classifiers, "chat")).toBe("chat");
  });

  it("is order-sensitive: precedence is array order, not an unordered lookup", () => {
    // A phrase that could plausibly match two classifiers must resolve to
    // whichever is listed first — the same contract magic-router relies on
    // for "prediction_market before solana_trading".
    const reordered: TaskClassifier<DummyTaskType>[] = [classifiers[1], classifiers[0]];
    expect(classifyTask("rm -rf /tmp/foo", reordered, "chat")).toBe("destructive_shell");
  });

  it("joins array input before classifying", () => {
    expect(classifyTask(["please", "run", "rm -rf", "now"], classifiers, "chat")).toBe("destructive_shell");
  });
});

describe("partitionByCategories", () => {
  const tools = [
    { id: "read-file", categories: [] },
    { id: "shell-exec", categories: ["destructive"] },
    { id: "git-force-push", categories: ["destructive", "vcs"] },
  ];

  it("passes everything through when nothing is blocked", () => {
    expect(partitionByCategories(tools, [])).toEqual({
      allowed: ["read-file", "shell-exec", "git-force-push"],
      blocked: [],
    });
  });

  it("blocks any tool carrying a blocked category", () => {
    expect(partitionByCategories(tools, ["destructive"])).toEqual({
      allowed: ["read-file"],
      blocked: ["shell-exec", "git-force-push"],
    });
  });

  it("treats a missing categories field as uncategorized (never blocked)", () => {
    expect(partitionByCategories([{ id: "no-tags" }], ["destructive"])).toEqual({
      allowed: ["no-tags"],
      blocked: [],
    });
  });
});

describe("createRouter (generic engine, dummy non-Solana config)", () => {
  const router = createRouter<DummyTaskType, DummyMode>({
    strategy: "dummy-router",
    classifiers,
    defaultTaskType: "chat",
    toolsForTask: (taskType) => {
      switch (taskType) {
        case "destructive_shell":
          return [{ id: "shell-exec", categories: ["destructive"] }, { id: "read-file" }];
        case "read_only_shell":
          return [{ id: "read-file" }];
        default:
          return [{ id: "chat" }];
      }
    },
    inferenceProviders: (env) => [
      { provider: "primary", model: "primary-model", credentialEnv: "PRIMARY_KEY", role: "selected", reason: "default", priority: 0 },
      { provider: "advisor", model: "advisor-model", credentialEnv: "ADVISOR_KEY", role: "advisor", reason: "advises", priority: 1 },
      { provider: "backup", model: "backup-model", credentialEnv: "BACKUP_KEY", role: "fallback", reason: "last resort", priority: 2 },
    ],
    modes: [
      { id: "autonomous", blockedCategories: [] },
      { id: "supervised", blockedCategories: ["destructive"], extraGuardrails: ["destructive-actions-disabled"] },
    ],
    defaultMode: "supervised",
    baseGuardrails: ["least-privilege-tools"],
    extend: ({ taskType }) => ({ classifiedAs: taskType }),
  });

  it("blocks destructive tools under the supervised mode's category", () => {
    const route = router.resolve("please rm -rf /tmp/foo", { PRIMARY_KEY: "k" }, "supervised");
    expect(route.taskType).toBe("destructive_shell");
    expect(route.toolSet).toEqual(["read-file"]);
    expect(route.blockedTools).toEqual(["shell-exec"]);
    expect(route.guardrails).toEqual(["least-privilege-tools", "destructive-actions-disabled"]);
  });

  it("allows destructive tools under autonomous mode", () => {
    const route = router.resolve("please rm -rf /tmp/foo", { PRIMARY_KEY: "k" }, "autonomous");
    expect(route.toolSet).toEqual(["shell-exec", "read-file"]);
    expect(route.blockedTools).toEqual([]);
    expect(route.guardrails).toEqual(["least-privilege-tools"]);
  });

  it("selects the highest-priority available provider and assigns the advisor role", () => {
    const route = router.resolve("chat", { PRIMARY_KEY: "k", ADVISOR_KEY: "k" }, "autonomous");
    expect(route.inference.provider).toBe("primary");
    expect(route.inference.role).toBe("selected");
    expect(route.advisor?.provider).toBe("advisor");
  });

  it("promotes a lower-priority provider to selected when higher-priority ones are unavailable", () => {
    const route = router.resolve("chat", { BACKUP_KEY: "k" }, "autonomous");
    expect(route.inference.provider).toBe("backup");
    expect(route.inference.role).toBe("selected");
  });

  it("carries domain-specific extras through the extend() escape hatch", () => {
    const route = router.resolve("ls -la", { PRIMARY_KEY: "k" }, "autonomous");
    expect(route.extensions).toEqual({ classifiedAs: "read_only_shell" });
  });

  it("describe() renders a human-readable summary", () => {
    const route = router.resolve("please rm -rf /tmp/foo", { PRIMARY_KEY: "k" }, "supervised");
    expect(router.describe(route)).toBe(
      "dummy-router[supervised]: destructive_shell -> primary/primary-model; tools=read-file; blocked=shell-exec",
    );
  });
});
