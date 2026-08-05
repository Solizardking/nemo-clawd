/**
 * Vulcan CLI Bridge — maps execution intents to Vulcan CLI commands or Rise SDK
 *
 * This adapter provides two paths:
 *   1. CLI path: "cargo run -p vulcan" via execFile
 *   2. Rise path: @ellipsis-labs/rise SDK instruction builders
 *
 * The Rise path is preferred when the SDK is available and configured for live execution.
 * The CLI path remains as a fallback for paper trading and environments without the SDK.
 */

import type { PreflightReport } from "../config.js";
import { resolveVulcanRoot } from "../paths.js";

// ─── Vulcan CLI Path Types ────────────────────────────────────────────────────

export interface VulcanBridgeCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface VulcanExecutionIntent {
  action:
    | "market-list"
    | "ticker"
    | "positions"
    | "paper-buy"
    | "paper-sell"
    | "live-buy"
    | "live-sell"
    | "rise-market-order"
    | "rise-limit-order"
    | "rise-stop-loss"
    | "rise-cancel"
    | "rise-cancel-all"
    | "rise-deposit"
    | "rise-withdraw";
  symbol?: string;
  notionalUsd?: number;
  priceUsd?: number;
  tokens?: number;
  triggerPrice?: number;
  orderIds?: string[];
  amountUsd?: number;
}

export interface VulcanExecutionPlan {
  transport: "cli" | "rise";
  mode: "observe" | "paper" | "live";
  preflight: PreflightReport;
  /** CLI path fields */
  command?: VulcanBridgeCommand;
  /** Rise path fields */
  description?: string;
  instructions?: unknown[];
  risk?: {
    estimatedPrice: number | null;
    estimatedSlippage: number | null;
    marginCheck: "pass" | "warn" | "fail";
    warnings: string[];
  };
  blocking?: string[];
}

// ─── Vulcan CLI Command Mapper ───────────────────────────────────────────────

export function mapToVulcanCommand(
  repoRoot: string,
  input: VulcanExecutionIntent,
): VulcanBridgeCommand {
  const vulcanRoot = resolveVulcanRoot(repoRoot);
  const symbol = input.symbol?.trim().toUpperCase() ?? "SOL";
  const notional = String(input.notionalUsd ?? 100);
  const base = {
    command: "cargo",
    cwd: `${vulcanRoot}/vulcan-cli-master`,
    env: { NO_COLOR: "1" },
  };

  switch (input.action) {
    case "market-list":
      return { ...base, args: ["run", "-p", "vulcan", "--", "market", "list", "-o", "json"] };
    case "ticker":
      return { ...base, args: ["run", "-p", "vulcan", "--", "market", "ticker", symbol, "-o", "json"] };
    case "positions":
      return { ...base, args: ["run", "-p", "vulcan", "--", "position", "list", "-o", "json"] };
    case "paper-buy":
      return {
        ...base,
        args: ["run", "-p", "vulcan", "--", "paper", "buy", symbol, "--notional-usdc", notional, "--type", "market", "-o", "json"],
      };
    case "paper-sell":
      return {
        ...base,
        args: ["run", "-p", "vulcan", "--", "paper", "sell", symbol, "--notional-usdc", notional, "--type", "market", "-o", "json"],
      };
    case "live-buy":
      return {
        ...base,
        args: ["run", "-p", "vulcan", "--", "trade", "buy", symbol, "--notional-usdc", notional, "--type", "market", "-o", "json"],
      };
    case "live-sell":
      return {
        ...base,
        args: ["run", "-p", "vulcan", "--", "trade", "sell", symbol, "--notional-usdc", notional, "--type", "market", "-o", "json"],
      };
    default:
      return {
        ...base,
        args: ["run", "-p", "vulcan", "--", "market", "list", "-o", "json"],
      };
  }
}

// ─── Execution Plan Builder ───────────────────────────────────────────────────

export function buildVulcanExecutionPlan(
  repoRoot: string,
  input: VulcanExecutionIntent,
  preflight: PreflightReport,
): VulcanExecutionPlan {
  const mode = input.action.startsWith("live")
    ? "live"
    : input.action.startsWith("paper")
      ? "paper"
      : "observe";

  // For Rise SDK-backed actions, return a Rise plan marker
  if (input.action.startsWith("rise-")) {
    return {
      transport: "rise",
      mode: preflight.ok ? "live" : "observe",
      preflight,
      description: `${input.action.replace("rise-", "").toUpperCase()} ${input.symbol ?? ""} ${input.notionalUsd ?? input.amountUsd ?? ""}`,
      instructions: [],
      risk: {
        estimatedPrice: input.priceUsd ?? null,
        estimatedSlippage: null,
        marginCheck: preflight.ok ? "pass" : "fail",
        warnings: [],
      },
      blocking: preflight.blocking,
    };
  }

  return {
    transport: "cli",
    mode,
    preflight,
    command: mapToVulcanCommand(repoRoot, input),
  };
}