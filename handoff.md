# Handoff: Make the Magic Router Composable for Any Agent

## Who this is for

An agent picking up the next phase of work on nemoclawd's request router. You have no prior
context on this conversation — everything you need is below or linked. This is a design +
implementation handoff, not a finished spec: some decisions are marked as open questions for
you (or the user) to resolve.

## Background

nemoclawd just shipped **AI Mode** (see PR
[Solizardking/nemo-clawd#1](https://github.com/Solizardking/nemo-clawd/pull/1)), a persistent
switch that hard-disables financial tools at the router level. Building that surfaced how
tightly the "magic router" is coupled to nemoclawd's specific Solana/DFlow/wallet domain. The
router itself — classify a request, pick tools, pick an inference route, apply
mode-based gating — is a generally useful pattern that has nothing to do with Solana. The ask
now: **extract that pattern into something composable, so any agent (not just nemoclawd) can
plug its own task types, tools, providers, and sensitive-tool categories into "our router"
instead of forking the file.**

## Current state (as of this handoff)

Two hand-maintained copies of the same logic exist and must stay behaviorally identical
(pre-existing pattern in this repo, not introduced by AI Mode):

| Concern | Plugin (TypeScript, compiled via `tsc`) | Standalone CLI (plain JS, required directly) |
|---|---|---|
| Router | `src/magic-router.ts` | `bin/lib/magic-router.js` |
| Mode / tool gating | `src/agent-mode.ts` | `bin/lib/mode.js` |
| Consumers | `src/index.ts`, `src/cli.ts`, `src/commands/mode.ts`, `src/commands/slash.ts` | `bin/nemoclawd.js` |
| Tests | `src/magic-router.test.ts`, `src/agent-mode.test.ts` (vitest) | `test/magic-router.test.js`, `test/mode.test.js`, `test/cli.test.js` (`node:test`) |

Everything below refers to the TS version; the JS version is a line-for-line mirror without
types.

### What's hardcoded today (`src/magic-router.ts`)

- **Task taxonomy** — `MagicRouterTaskType` is a fixed union: `coding | solana_trading |
  prediction_market | wallet_ops | research | general`. `classifyMagicRouterTask()` is a
  single function with inline regexes for exactly these six categories, evaluated in a fixed
  priority order (line 61–69).
- **Tool sets** — `toolSetForTask()` (line 71–88) is a `switch` over that same fixed union,
  returning literal tool-id arrays like `["dflow-order", "dflow-book-stream", "solana-rpc",
  "wallet-approval"]`. There's no way to add a task type or change its tools without editing
  this function.
- **Inference providers** — `buildInferenceRoutes()` (line 90–123) hardcodes exactly three
  providers (`zai-glm`, `openrouter`, `nvidia-nim`), their models, their env var names, and a
  fixed priority order (zai → openrouter → nvidia). Adding a fourth provider means editing this
  function.
- **Nemoclawd-shaped output** — `MagicRouterRoute` (line 35–50) has a first-class `dflow: {
  spotTradingDefault, predictionMarketDefault, credentialEnv }` field. That's meaningless for
  an agent that isn't nemoclawd; it leaked in because it was convenient at the time.
- **Sensitive-tool list is separate but still hardcoded** — `FINANCIAL_TOOLS` in
  `src/agent-mode.ts` (line 28–36) is a fixed `Set` of nemoclawd's specific tool ids. AI Mode's
  `partitionToolsForMode()` (agent-mode.ts line 43–54) filters against that one fixed set.
  There's only one axis of gating (financial vs. not) and only two modes (`ai`, `trading`) —
  both baked into the `AgentMode` union type itself (agent-mode.ts line 22).

None of this is wrong for nemoclawd's own use — it's just not reusable as-is. That's the gap
to close.

## Goal

Turn the router into a small, generic **resolution engine** — `classify → pick tools → pick
inference → gate by mode → return a route` — that takes its taxonomy, tool sets, providers,
and sensitive-tool categories as *configuration*, not as compiled-in constants. nemoclawd's
current behavior (Solana task types, DFlow tools, zai/openrouter/nvidia providers, the
financial-tools-only AI Mode) becomes **one instantiation** of that engine, not the engine
itself.

## Proposed shape (starting point, not gospel)

```ts
// Generic core — no Solana/DFlow/nemoclawd knowledge at all.

interface TaskClassifier<TTaskType extends string> {
  taskType: TTaskType;
  /** Evaluated in array order; first match wins — same precedence rule as today. */
  test: (text: string) => boolean;
}

interface ToolProvider {
  id: string;
  /** Free-form tags used for mode gating, e.g. ["financial", "signing"]. */
  categories?: string[];
}

interface InferenceProviderConfig {
  provider: string;
  model: string;
  credentialEnv: string;
  role: "selected" | "advisor" | "fallback";
  endpoint?: string;
  reason: string;
  /** Priority order when multiple providers are available; lower = preferred. */
  priority: number;
}

interface RouterMode<TModeId extends string> {
  id: TModeId;
  /** Tool categories hard-blocked in this mode, regardless of classification. */
  blockedCategories: string[];
  extraGuardrails?: string[];
}

interface RouterConfig<TTaskType extends string, TModeId extends string> {
  strategy: string;
  classifiers: TaskClassifier<TTaskType>[];
  defaultTaskType: TTaskType;
  toolsForTask: (taskType: TTaskType, ctx: { availableProviders: string[] }) => ToolProvider[];
  inferenceProviders: (env: EnvLike) => InferenceProviderConfig[];
  modes: RouterMode<TModeId>[];
  defaultMode: TModeId;
  baseGuardrails: string[];
  /** Escape hatch for domain-specific extras (nemoclawd's `dflow` block lives here now). */
  extend?: (input: unknown, env: EnvLike, mode: TModeId) => Record<string, unknown>;
}

function createRouter<TTaskType extends string, TModeId extends string>(
  config: RouterConfig<TTaskType, TModeId>,
): {
  resolve(input: string | string[] | undefined, env?: EnvLike, mode?: TModeId): RouterRoute<TTaskType, TModeId>;
  describe(route: RouterRoute<TTaskType, TModeId>): string;
};
```

`src/magic-router.ts` then becomes a *config file* that calls `createRouter({...})` with
nemoclawd's six task types, its DFlow/wallet tool sets tagged with a `"financial"` category,
its three inference providers, and two modes (`trading`: nothing blocked; `ai`: blocks
`"financial"`). The `dflow` block moves into `extend()`. Existing exports
(`resolveMagicRouter`, `classifyMagicRouterTask`, `describeMagicRouter`,
`MagicRouterTaskType`, `MagicRouterRoute`, etc.) stay as thin re-exports/type-aliases bound to
that one instantiation, so **every existing caller keeps working unchanged.**

Same idea applies to `agent-mode.ts`: `FINANCIAL_TOOLS` becomes "the set of tool ids tagged
`financial` in nemoclawd's router config," not a router-agnostic constant. If another agent
wants a `"destructive"` category instead (e.g., blocking `rm`, `git push --force`), it defines
its own categories and its own modes against the same generic engine — it does not touch
nemoclawd's file.

## Constraints — do not break these

1. **Every existing public API must keep working with its current signature and return
   shape**, including the `dflow` field on `MagicRouterRoute` for nemoclawd's own callers.
   Check by re-running the existing test suites (below) after the refactor — they should pass
   with zero changes to their assertions.
2. **Classification precedence is a contract.** `prediction_market` is currently checked before
   `solana_trading` specifically so "prediction market outcome token" doesn't get misclassified
   as generic trading (see `test/magic-router.test.js`, "classifies prediction-market tasks
   before generic trading"). Whatever config format you choose must preserve "array order =
   precedence," not silently reorder on you (e.g. don't switch to an unordered `Record`).
3. **The JS/TS duplication problem is real and connects to this work** — if you introduce a
   generic core, strongly consider whether `bin/lib/magic-router.js` should keep hand-mirroring
   forever, or whether the standalone CLI should require a compiled-from-`src` artifact instead
   (there's already a `build:plugin` npm script running `tsc`, and `dist/` exists as a build
   output — check whether `bin/` could import from `dist/` instead of maintaining a parallel
   JS copy). This is explicitly **your call to make or escalate** — see Open Questions.
4. **`AGENT_MODES` / `AgentMode` are consumed outside the router**: `src/index.ts` (startup
   banner), `src/cli.ts` / `src/commands/mode.ts` (CLI), `src/commands/slash.ts` (slash
   command), and their `bin/` equivalents all import `isAgentMode` / `getAgentMode` /
   `setAgentMode` / `describeAgentMode` directly. If modes become part of a per-agent router
   config rather than a fixed two-value union, these call sites need a plan too — don't leave
   them importing a type that no longer exists.
5. Keep the SPDX header (`Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES... Apache-2.0`) on
   any new file — every existing `src/*.ts` and `bin/lib/*.js` file has it.

## Test baseline (must stay green)

```bash
node --test test/*.test.js      # 85 tests, 84 pass — the 1 failure (ensureDockerCliOnPath in
                                 # runner.test.js) is pre-existing/environment-specific and
                                 # unrelated to the router; do not try to fix it as part of this
```

For the TS/vitest side, `node_modules` isn't installed in a fresh checkout of this repo (the
`nemoclawd@^1.0.0` dependency in `package.json` 404s on the real npm registry — pre-existing,
unrelated to this work). To run vitest anyway:

```bash
mkdir -p /tmp/tsctmp && cd /tmp/tsctmp && npm init -y >/dev/null && \
  npm install --no-save vitest@4.1.9 typescript@5.6.3 @types/node@22 commander@12
ln -s /tmp/tsctmp/node_modules /path/to/nemo-clawd/node_modules   # remove when done
node /tmp/tsctmp/node_modules/vitest/vitest.mjs run                # or wherever npx cached it
```

Add new tests alongside the existing ones for whatever generic-engine module you introduce
(follow the existing style in `src/magic-router.test.ts` / `src/agent-mode.test.ts` — plain
`describe`/`it`, no exotic mocking).

## Open questions (resolve with the user before committing to an approach)

1. **Scope of "any agent"**: is this meant to stay in-repo as a config-per-agent pattern (what
   this doc sketches), or does the user want the core engine extracted as a standalone
   published package other repos can `npm install`? That changes versioning, where the code
   lives, and whether nemoclawd's `dflow`-specific bits can leak into it at all.
2. **JS/TS duplication**: fix now (build `bin/` from `dist/`) or preserve the existing
   hand-mirror pattern and just mirror the new generic core too? Recommend raising this
   explicitly — it's a meaningful scope decision, not a detail.
3. **Category taxonomy**: is a flat `categories: string[]` tag on each tool enough, or does the
   user want structured severity levels (e.g. `"financial:read" vs "financial:write"`) so a
   mode can block signing but allow balance checks? AI Mode today blocks all financial tools
   uniformly (see `FINANCIAL_TOOLS` in `src/agent-mode.ts`) — confirm whether that's the
   desired granularity going forward or whether this refactor should also add finer-grained
   gating.
4. **Backwards compatibility window**: can `MagicRouterRoute.dflow` be deprecated in favor of a
   generic `extensions` bag with a follow-up removal, or must it stay indefinitely for external
   consumers? Check `nemoclawd-mcp/` and `nemo-clawd-python/` for anything that consumes the
   router's JSON output shape (e.g. via `nemoclawd magic-router --json`) before assuming it's
   safe to reshape.

## Where to start

1. Read `src/magic-router.ts`, `src/agent-mode.ts`, and their tests end to end — they're short
   (under 170 and 105 lines respectively).
2. Sketch the generic core in a new file (e.g. `src/router/core.ts`) with no imports from
   anything Solana/DFlow-specific.
3. Rewrite `src/magic-router.ts` and `src/agent-mode.ts` to be thin nemoclawd configs on top of
   that core, preserving every existing export.
4. Get `node --test test/*.test.js` and the vitest suite green with zero test-file changes.
5. Only then decide (with the user, per Open Question 2) whether to also collapse the
   `bin/lib/*.js` mirror, and mirror the new core there if not.
6. Update `docs/reference/commands.md` (the "AI Mode" section documents today's fixed
   categories/modes and will need a note once they're configurable) and this repo's `README.md`
   AI Mode section similarly.
