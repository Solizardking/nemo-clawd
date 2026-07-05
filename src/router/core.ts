// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Generic request-routing engine: classify a request, pick a tool set, pick
 * an inference provider, and gate both by an active "mode" — with zero
 * knowledge of any particular agent's task taxonomy, tools, or providers.
 * An agent config (e.g. ../magic-router.ts) supplies those as data; this
 * module only supplies the resolution algorithm.
 */

export type EnvLike = Record<string, string | undefined>;

export interface TaskClassifier<TTaskType extends string> {
  taskType: TTaskType;
  /** Evaluated in array order against the lowercased input; first match wins. */
  test: (text: string) => boolean;
}

export interface CategorizedTool {
  id: string;
  /** Free-form tags used for mode gating, e.g. ["financial", "signing"]. */
  categories?: string[];
}

export interface InferenceRoute {
  provider: string;
  model: string;
  credentialEnv: string;
  available: boolean;
  role: "selected" | "advisor" | "fallback";
  endpoint?: string;
  reason: string;
}

export interface InferenceProviderConfig {
  provider: string;
  model: string;
  credentialEnv: string;
  /** Role this provider plays when it is not chosen as primary. */
  role: "selected" | "advisor" | "fallback";
  endpoint?: string;
  reason: string;
  /** Priority order when multiple providers are available; lower = preferred as primary. */
  priority: number;
}

export interface RouterMode<TModeId extends string> {
  id: TModeId;
  /** Tool categories hard-blocked while this mode is active, regardless of classification. */
  blockedCategories: string[];
  /** Guardrail ids appended to every route while this mode is active. */
  extraGuardrails?: string[];
}

export interface RouterRoute<TTaskType extends string, TModeId extends string> {
  strategy: string;
  mode: TModeId;
  taskType: TTaskType;
  inference: InferenceRoute;
  advisor?: InferenceRoute;
  fallbacks: InferenceRoute[];
  toolSet: string[];
  blockedTools: string[];
  guardrails: string[];
  /** Escape hatch for domain-specific fields an agent config wants on every route. */
  extensions: Record<string, unknown>;
}

export interface RouterConfig<TTaskType extends string, TModeId extends string> {
  strategy: string;
  classifiers: TaskClassifier<TTaskType>[];
  defaultTaskType: TTaskType;
  toolsForTask: (
    taskType: TTaskType,
    ctx: { env: EnvLike; inference: { selected: InferenceRoute; advisor?: InferenceRoute } },
  ) => CategorizedTool[];
  inferenceProviders: (env: EnvLike) => InferenceProviderConfig[];
  modes: RouterMode<TModeId>[];
  defaultMode: TModeId;
  baseGuardrails: string[];
  /** Domain-specific extras an agent config wants attached to every route (e.g. nemoclawd's `dflow` block). */
  extend?: (ctx: { taskType: TTaskType; mode: TModeId; env: EnvLike }) => Record<string, unknown>;
}

function textFromInput(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input.join(" ");
  return input || "";
}

function hasEnv(env: EnvLike, key: string): boolean {
  return Boolean(env[key]?.trim());
}

export function classifyTask<TTaskType extends string>(
  input: string | string[] | undefined,
  classifiers: readonly TaskClassifier<TTaskType>[],
  defaultTaskType: TTaskType,
): TTaskType {
  const text = textFromInput(input).toLowerCase();
  for (const classifier of classifiers) {
    if (classifier.test(text)) return classifier.taskType;
  }
  return defaultTaskType;
}

/** Split tools into allowed/blocked by whether any of their categories is in blockedCategories. */
export function partitionByCategories(
  tools: readonly CategorizedTool[],
  blockedCategories: readonly string[],
): { allowed: string[]; blocked: string[] } {
  if (blockedCategories.length === 0) return { allowed: tools.map((t) => t.id), blocked: [] };
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const tool of tools) {
    const isBlocked = (tool.categories || []).some((category) => blockedCategories.includes(category));
    (isBlocked ? blocked : allowed).push(tool.id);
  }
  return { allowed, blocked };
}

function resolveInference(
  env: EnvLike,
  providers: readonly InferenceProviderConfig[],
): { selected: InferenceRoute; advisor?: InferenceRoute; fallbacks: InferenceRoute[] } {
  const routes: InferenceRoute[] = providers.map((p) => ({
    provider: p.provider,
    model: p.model,
    credentialEnv: p.credentialEnv,
    available: hasEnv(env, p.credentialEnv),
    role: p.role,
    endpoint: p.endpoint,
    reason: p.reason,
  }));

  const byPriority = routes.map((_, i) => i).sort((a, b) => providers[a].priority - providers[b].priority);
  const primaryIdx = byPriority.find((i) => routes[i].available) ?? byPriority[0];
  const selected: InferenceRoute = { ...routes[primaryIdx], role: "selected" };
  const advisorIdx = routes.findIndex((r, i) => i !== primaryIdx && r.role === "advisor" && r.available);
  const advisor = advisorIdx >= 0 ? routes[advisorIdx] : undefined;
  const fallbacks = routes.filter((_, i) => i !== primaryIdx);

  return { selected, advisor, fallbacks };
}

export function createRouter<TTaskType extends string, TModeId extends string>(
  config: RouterConfig<TTaskType, TModeId>,
): {
  resolve(input: string | string[] | undefined, env?: EnvLike, mode?: TModeId): RouterRoute<TTaskType, TModeId>;
  describe(
    route: Pick<RouterRoute<TTaskType, TModeId>, "strategy" | "mode" | "taskType" | "inference" | "advisor" | "toolSet" | "blockedTools">,
  ): string;
} {
  function resolve(
    input: string | string[] | undefined,
    env: EnvLike = process.env,
    mode: TModeId = config.defaultMode,
  ): RouterRoute<TTaskType, TModeId> {
    const taskType = classifyTask(input, config.classifiers, config.defaultTaskType);
    const inference = resolveInference(env, config.inferenceProviders(env));
    const modeConfig = config.modes.find((m) => m.id === mode) ?? config.modes.find((m) => m.id === config.defaultMode)!;
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

  function describe(
    route: Pick<RouterRoute<TTaskType, TModeId>, "strategy" | "mode" | "taskType" | "inference" | "advisor" | "toolSet" | "blockedTools">,
  ): string {
    const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
    const blocked = route.blockedTools.length ? `; blocked=${route.blockedTools.join(",")}` : "";
    return `${route.strategy}[${route.mode}]: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}${blocked}`;
  }

  return { resolve, describe };
}
