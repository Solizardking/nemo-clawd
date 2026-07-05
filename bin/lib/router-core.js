// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Generic request-routing engine: classify a request, pick a tool set, pick
 * an inference provider, and gate both by an active "mode" — with zero
 * knowledge of any particular agent's task taxonomy, tools, or providers.
 * An agent config (e.g. ./magic-router.js) supplies those as data; this
 * module only supplies the resolution algorithm.
 *
 * Mirrors ../../src/router/core.ts line-for-line (minus types) — keep both
 * in sync, same as the existing magic-router.js / mode.js mirrors.
 */

function textFromInput(input) {
  if (Array.isArray(input)) return input.join(" ");
  return input || "";
}

function hasEnv(env, key) {
  return Boolean(env[key] && String(env[key]).trim());
}

function classifyTask(input, classifiers, defaultTaskType) {
  const text = textFromInput(input).toLowerCase();
  for (const classifier of classifiers) {
    if (classifier.test(text)) return classifier.taskType;
  }
  return defaultTaskType;
}

function partitionByCategories(tools, blockedCategories) {
  if (blockedCategories.length === 0) return { allowed: tools.map((t) => t.id), blocked: [] };
  const allowed = [];
  const blocked = [];
  for (const tool of tools) {
    const isBlocked = (tool.categories || []).some((category) => blockedCategories.includes(category));
    (isBlocked ? blocked : allowed).push(tool.id);
  }
  return { allowed, blocked };
}

function resolveInference(env, providers) {
  const routes = providers.map((p) => ({
    provider: p.provider,
    model: p.model,
    credentialEnv: p.credentialEnv,
    available: hasEnv(env, p.credentialEnv),
    role: p.role,
    endpoint: p.endpoint,
    reason: p.reason,
  }));

  const byPriority = routes.map((_, i) => i).sort((a, b) => providers[a].priority - providers[b].priority);
  const found = byPriority.find((i) => routes[i].available);
  const primaryIdx = found === undefined ? byPriority[0] : found;
  const selected = { ...routes[primaryIdx], role: "selected" };
  const advisorIdx = routes.findIndex((r, i) => i !== primaryIdx && r.role === "advisor" && r.available);
  const advisor = advisorIdx >= 0 ? routes[advisorIdx] : undefined;
  const fallbacks = routes.filter((_, i) => i !== primaryIdx);

  return { selected, advisor, fallbacks };
}

function createRouter(config) {
  function resolve(input, env = process.env, mode = config.defaultMode) {
    const taskType = classifyTask(input, config.classifiers, config.defaultTaskType);
    const inference = resolveInference(env, config.inferenceProviders(env));
    const modeConfig = config.modes.find((m) => m.id === mode) || config.modes.find((m) => m.id === config.defaultMode);
    const rawTools = config.toolsForTask(taskType, { env, inference });
    const { allowed: toolSet, blocked: blockedTools } = partitionByCategories(rawTools, modeConfig.blockedCategories);

    return {
      strategy: config.strategy,
      mode,
      taskType,
      inference: inference.selected,
      advisor: inference.advisor,
      fallbacks: inference.fallbacks,
      toolSet,
      blockedTools,
      guardrails: [...config.baseGuardrails, ...(modeConfig.extraGuardrails || [])],
      extensions: config.extend ? config.extend({ taskType, mode, env }) : {},
    };
  }

  function describe(route) {
    const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
    const blocked = route.blockedTools && route.blockedTools.length ? `; blocked=${route.blockedTools.join(",")}` : "";
    return `${route.strategy}[${route.mode}]: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}${blocked}`;
  }

  return { resolve, describe };
}

module.exports = {
  classifyTask,
  partitionByCategories,
  createRouter,
};
