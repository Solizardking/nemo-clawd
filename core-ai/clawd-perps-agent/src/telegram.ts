import { ClawdPerpsRuntime } from "./marketMaker.js";
import { buildPerpsFrontendStatus } from "./frontend.js";
import { errorMessage } from "./errors.js";

export interface TelegramPerpsCommand {
  command: string;
  description: string;
}

export interface TelegramPerpsResponse {
  ok: boolean;
  text: string;
  data?: unknown;
}

export const TELEGRAM_PERPS_COMMANDS: TelegramPerpsCommand[] = [
  { command: "/perps", description: "Show runtime status and safety mode" },
  { command: "/perps_vulcan", description: "Show integrated Vulcan CLI and MCP status" },
  { command: "/perps_markets", description: "List tracked Phoenix perp markets" },
  { command: "/perps_positions", description: "Show current perp positions" },
  { command: "/perps_paper_long", description: "Preview a paper long route" },
  { command: "/perps_paper_short", description: "Preview a paper short route" },
  { command: "/perps_live_long", description: "Preview a blocked/allowed live long route" },
  { command: "/perps_live_short", description: "Preview a blocked/allowed live short route" },
  // Rise SDK commands
  { command: "/perps_rise_orderbook", description: "Get L2 orderbook via Rise SDK: /perps_rise_orderbook SOL [depth]" },
  { command: "/perps_rise_funding", description: "Get funding rates via Rise SDK: /perps_rise_funding SOL" },
  { command: "/perps_rise_candles", description: "Get OHLCV candles via Rise SDK: /perps_rise_candles SOL [interval] [limit]" },
  { command: "/perps_rise_bbo", description: "Get best bid/offer via Hawkeye: /perps_rise_bbo SOL" },
  { command: "/perps_rise_stats", description: "Get market stats via Rise SDK: /perps_rise_stats SOL" },
  { command: "/perps_rise_market_buy", description: "Build unsigned market buy: /perps_rise_market_buy SOL [notional] [slippageBps]" },
  { command: "/perps_rise_market_sell", description: "Build unsigned market sell: /perps_rise_market_sell SOL [notional] [slippageBps]" },
  { command: "/perps_rise_margin", description: "Get margin status (collateral, liquidation risk) via Hawkeye" },
];

function parseArgs(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function readSymbol(args: string[], fallback = "SOL"): string {
  return (args[1] ?? fallback).toUpperCase();
}

function readNotional(args: string[], fallback = 100): number {
  const value = Number(args[2] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

function formatBlocking(blocking: string[]): string {
  return blocking.length > 0 ? blocking.join(" | ") : "no blocking conditions";
}

export async function handleTelegramPerpsCommand(
  runtime: ClawdPerpsRuntime,
  text: string,
): Promise<TelegramPerpsResponse> {
  const args = parseArgs(text);
  const command = args[0] ?? "/perps";

  switch (command) {
    case "/perps": {
      const [status, frontend] = await Promise.all([
        runtime.getRuntimeHealth(),
        buildPerpsFrontendStatus(runtime),
      ]);
      return {
        ok: true,
        text: joinLines([
          `${frontend.modeLabel} | ${status.trackedMarkets} markets in view`,
          frontend.headline,
          frontend.subheadline,
          `wallet=${status.walletConfigured ? "wired" : "missing"} | symbols=${status.allowedSymbols.join(", ")}`,
        ]),
        data: { ...status, frontend },
      };
    }
    case "/perps_vulcan": {
      const catalog = await runtime.getVulcanCatalogSummary();
      return {
        ok: true,
        text: joinLines([
          "Vulcan bridge is mounted and readable.",
          `cli=${catalog.cliVersion} | groups=${catalog.groupCount} | commands=${catalog.commandCount}`,
          `dangerous routes=${catalog.dangerousCommands} | MCP=${catalog.mcpServer ? "present" : "missing"}`,
        ]),
        data: catalog,
      };
    }
    case "/perps_markets": {
      let markets;
      try {
        markets = await runtime.listMarkets();
      } catch (error) {
        return {
          ok: false,
          text: joinLines([
            "Market tape is unavailable from the Phoenix/Rise read plane.",
            errorMessage(error),
          ]),
          data: { error: errorMessage(error) },
        };
      }
      return {
        ok: true,
        text: joinLines([
          "Market tape is live.",
          `${markets.length} tracked symbols: ${markets.map((market) => market.symbol).join(", ")}`,
        ]),
        data: markets,
      };
    }
    case "/perps_positions": {
      let positions;
      try {
        positions = await runtime.getPositions();
      } catch (error) {
        return {
          ok: false,
          text: joinLines([
            "Position snapshot is unavailable from the Phoenix/Rise read plane.",
            errorMessage(error),
          ]),
          data: { error: errorMessage(error) },
        };
      }
      return {
        ok: true,
        text: joinLines([
          "Current position snapshot loaded.",
          Array.isArray(positions) && positions.length > 0
            ? `${positions.length} position rows returned from the read plane.`
            : "No active position rows returned.",
        ]),
        data: positions,
      };
    }
    case "/perps_paper_long": {
      const preview = runtime.previewPaperTrade(readSymbol(args), "buy", readNotional(args));
      return {
        ok: preview.preflight.ok,
        text: preview.preflight.ok
          ? joinLines([
              `Paper long route staged for ${preview.symbol}.`,
              `${preview.notionalUsd} USDC notional | adapter=${preview.route.adapter} | execution=${preview.execution}`,
              "This is rehearsal flow only. No real funds should move.",
            ])
          : joinLines([
              `Paper long route blocked for ${preview.symbol}.`,
              formatBlocking(preview.preflight.blocking),
            ]),
        data: preview,
      };
    }
    case "/perps_paper_short": {
      const preview = runtime.previewPaperTrade(readSymbol(args), "sell", readNotional(args));
      return {
        ok: preview.preflight.ok,
        text: preview.preflight.ok
          ? joinLines([
              `Paper short route staged for ${preview.symbol}.`,
              `${preview.notionalUsd} USDC notional | adapter=${preview.route.adapter} | execution=${preview.execution}`,
              "The engine can rehearse the move without opening live exposure.",
            ])
          : joinLines([
              `Paper short route blocked for ${preview.symbol}.`,
              formatBlocking(preview.preflight.blocking),
            ]),
        data: preview,
      };
    }
    case "/perps_live_long": {
      const preview = runtime.previewLiveTrade(readSymbol(args), "buy", readNotional(args));
      return {
        ok: preview.preflight.ok,
        text: preview.preflight.ok
          ? joinLines([
              `Live long preview is open for ${preview.symbol}.`,
              `${preview.notionalUsd} USDC notional cleared the current gate set.`,
              "This is still a preview path until signing and submission are wired.",
            ])
          : joinLines([
              `Live long remains blocked for ${preview.symbol}.`,
              formatBlocking(preview.preflight.blocking),
            ]),
        data: preview,
      };
    }
    case "/perps_live_short": {
      const preview = runtime.previewLiveTrade(readSymbol(args), "sell", readNotional(args));
      return {
        ok: preview.preflight.ok,
        text: preview.preflight.ok
          ? joinLines([
              `Live short preview is open for ${preview.symbol}.`,
              `${preview.notionalUsd} USDC notional cleared the current gate set.`,
              "Execution is described here, not blindly triggered here.",
            ])
          : joinLines([
              `Live short remains blocked for ${preview.symbol}.`,
              formatBlocking(preview.preflight.blocking),
            ]),
        data: preview,
      };
    }
    // ── Rise SDK Commands ──
    case "/perps_rise_orderbook": {
      const sym = readSymbol(args);
      const depth = Number(args[2] ?? 20);
      try {
        const ob = await runtime.getOrderbook(sym, Number.isFinite(depth) && depth > 0 ? depth : 20);
        const bidStr = ob.bids.slice(0, 5).map((b) => `${b.price} x ${b.size}`).join("; ");
        const askStr = ob.asks.slice(0, 5).map((a) => `${a.price} x ${a.size}`).join("; ");
        return {
          ok: true,
          text: joinLines([
            `📊 ${sym} orderbook (${ob.source})`,
            `Bids: ${bidStr || "none"}`,
            `Asks: ${askStr || "none"}`,
            `${ob.bids.length} bids / ${ob.asks.length} asks`,
          ]),
          data: ob,
        };
      } catch (error) {
        return { ok: false, text: `Orderbook failed for ${sym}: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_funding": {
      const sym = readSymbol(args);
      try {
        const rates = await runtime.getFundingRates(sym);
        const rows = rates.map((r) => `${r.symbol}: current=${(r.currentFundingRate * 100).toFixed(4)}% | 8h=${(r.eightHourFundingRate * 100).toFixed(4)}% | annual=${(r.annualizedFundingRate * 100).toFixed(2)}%`).join("\n");
        return {
          ok: true,
          text: joinLines([`💰 Funding rates (${rates.length > 0 ? rates[0].source : "unknown"})`, rows || "No rates available"]),
          data: rates,
        };
      } catch (error) {
        return { ok: false, text: `Funding rates failed: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_candles": {
      const sym = readSymbol(args);
      const interval = args[2] ?? "1h";
      const limit = Number(args[3] ?? 20);
      try {
        const candles = await runtime.getCandles(sym, interval, Number.isFinite(limit) ? limit : 20);
        if (candles.length === 0) return { ok: true, text: `No candles for ${sym} (${interval})`, data: [] };
        const latest = candles[candles.length - 1];
        const change = ((latest.close - latest.open) / latest.open * 100).toFixed(2);
        return {
          ok: true,
          text: joinLines([
            `🕯️ ${sym} candles (${interval}, last ${candles.length})`,
            `O=${latest.open} H=${latest.high} L=${latest.low} C=${latest.close} V=${latest.volume}`,
            `Change: ${change}%`,
          ]),
          data: candles,
        };
      } catch (error) {
        return { ok: false, text: `Candles failed for ${sym}: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_bbo": {
      const sym = readSymbol(args);
      try {
        const bbo = await runtime.getBbo(sym);
        const spread = bbo.bid !== null && bbo.ask !== null ? ((bbo.ask - bbo.bid) / bbo.bid * 100).toFixed(3) : "N/A";
        return {
          ok: true,
          text: joinLines([
            `🎯 ${sym} BBO`,
            `Bid: ${bbo.bid ?? "N/A"} | Ask: ${bbo.ask ?? "N/A"} | Mark: ${bbo.mark ?? "N/A"}`,
            `Spread: ${spread}%`,
          ]),
          data: bbo,
        };
      } catch (error) {
        return { ok: false, text: `BBO failed for ${sym}: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_stats": {
      const sym = readSymbol(args);
      try {
        const stats = await runtime.getMarketStats(sym);
        return {
          ok: true,
          text: joinLines([
            `📈 ${sym} stats (${stats.source})`,
            `Mark: ${stats.markPrice ?? "N/A"} | Oracle: ${stats.oraclePrice ?? "N/A"}`,
            `Volume 24h: $${(stats.dayVolumeUsd ?? 0).toLocaleString()} | OI: ${(stats.openInterest ?? 0).toLocaleString()}`,
            `Funding: ${(stats.currentFundingRate ?? 0).toFixed(6)} | Annual: ${(stats.annualizedFundingRate ?? 0).toFixed(4)}`,
          ]),
          data: stats,
        };
      } catch (error) {
        return { ok: false, text: `Stats failed for ${sym}: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_market_buy":
    case "/perps_rise_market_sell": {
      const sym = readSymbol(args);
      const side = command === "/perps_rise_market_sell" ? "sell" as const : "buy" as const;
      const notional = readNotional(args);
      const slippageBps = Number(args[3] ?? 50);
      try {
        const plan = await runtime.executeMarketOrder({ symbol: sym, side, notionalUsd: notional, slippageBps: Number.isFinite(slippageBps) ? slippageBps : 50 });
        if (!plan.ok) {
          return { ok: false, text: joinLines([`🚫 Market ${side} blocked for ${sym}`, formatBlocking(plan.blocking)]), data: plan };
        }
        return {
          ok: true,
          text: joinLines([
            `📝 Market ${side} order built for ${sym}`,
            `${notional} USDC | estPrice=$${plan.risk.estimatedPrice ?? "N/A"} | slippage=${((plan.risk.estimatedSlippage ?? 0) * 100).toFixed(2)}%`,
            `Mode: ${plan.mode} | Instructions: ${plan.instructions.length}`,
            plan.risk.warnings.length > 0 ? `Warnings: ${plan.risk.warnings.join(" | ")}` : "",
          ]),
          data: plan,
        };
      } catch (error) {
        return { ok: false, text: `Market ${side} failed for ${sym}: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    case "/perps_rise_margin": {
      try {
        const margin = await runtime.getMarginStatus();
        return {
          ok: true,
          text: joinLines([
            `🛡️ Margin status (${margin.source})`,
            `Collateral: $${margin.totalCollateralUsd.toFixed(2)} | Free: $${margin.freeCollateralUsd.toFixed(2)}`,
            `Maint: $${margin.maintenanceMarginUsd.toFixed(2)} | Equity: $${margin.equityUsd.toFixed(2)}`,
            `Ratio: ${(margin.marginRatio * 100).toFixed(2)}%`,
            margin.isLiquidatable ? "⚠️ LIQUIDATABLE" : "✅ Safe",
          ]),
          data: margin,
        };
      } catch (error) {
        return { ok: false, text: `Margin status failed: ${errorMessage(error)}`, data: { error: errorMessage(error) } };
      }
    }
    default:
      return {
        ok: false,
        text: `Unknown command ${command}. Supported: ${TELEGRAM_PERPS_COMMANDS.map((item) => item.command).join(", ")}`,
      };
  }
}

