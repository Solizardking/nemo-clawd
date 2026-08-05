/**
 * Google Agent Runtime Server — Perps Agent HTTP endpoint
 *
 * Serves the Clawd Perps Agent as a Cloud Run service compatible with
 * Google Agent Runtime (Vertex AI Agent Builder).
 *
 * Endpoints:
 *   GET  /health          — Health check
 *   POST /agent:query     — Agent query (MCP-compatible tool calling)
 *   POST /agent/tool      — Direct tool invocation
 *   GET  /agent/tools     — List available tools
 *   GET  /agent/context   — Agent context metadata
 *   GET  /openapi.json    — OpenAPI spec
 */

import express from "express";
import cors from "cors";
import { loadClawdPerpsEnv } from "./src/env.js";
import { ClawdPerpsRuntime } from "./src/marketMaker.js";
import { loadPerpsRuntimeConfig, resolveTradingMode } from "./src/config.js";
import { ImperialClient } from "./src/imperialAgent.js";

// Load environment
loadClawdPerpsEnv();

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);

app.use(cors());
app.use(express.json());

// ─── Runtime ──────────────────────────────────────────────────────────────────

let runtime: ClawdPerpsRuntime;

async function getRuntime(): Promise<ClawdPerpsRuntime> {
  if (!runtime) {
    runtime = new ClawdPerpsRuntime(loadPerpsRuntimeConfig());
    await runtime.init();
  }
  return runtime;
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "perps_list_markets",
    description: "List all available Phoenix perpetual markets with mark price, funding, volume, and spread",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "perps_get_ticker",
    description: "Get current ticker for a perpetual market",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol (e.g. SOL, BTC, ETH)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "perps_get_orderbook",
    description: "Get L2 orderbook for a perpetual market",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        depth: { type: "number", description: "Number of levels per side", default: 20 },
      },
      required: ["symbol"],
    },
  },
  {
    name: "perps_get_candles",
    description: "Get OHLCV candle history for a market",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        interval: { type: "string", description: "Candle interval: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w", default: "1h" },
        limit: { type: "number", description: "Number of candles", default: 20 },
      },
      required: ["symbol"],
    },
  },
  {
    name: "perps_get_funding",
    description: "Get current funding rates for a market",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol (optional, returns all if omitted)" },
      },
    },
  },
  {
    name: "perps_get_market_stats",
    description: "Get full market statistics including volume, OI, funding, mark price",
    parameters: {
      type: "object",
      properties: { symbol: { type: "string", description: "Market symbol" } },
      required: ["symbol"],
    },
  },
  {
    name: "perps_get_bbo",
    description: "Get best bid/offer with mark price via on-chain Hawkeye simulation",
    parameters: {
      type: "object",
      properties: { symbol: { type: "string", description: "Market symbol" } },
      required: ["symbol"],
    },
  },
  {
    name: "perps_get_margin",
    description: "Get margin status (collateral, maintenance margin, liquidation risk)",
    parameters: {
      type: "object",
      properties: {
        authority: { type: "string", description: "Wallet pubkey (optional, uses configured wallet)" },
      },
    },
  },
  {
    name: "perps_get_positions",
    description: "Get open positions across all subaccounts",
    parameters: {
      type: "object",
      properties: {
        authority: { type: "string", description: "Wallet pubkey (optional)" },
      },
    },
  },
  {
    name: "perps_get_trader_snapshot",
    description: "Get full trader snapshot with subaccounts, collateral, positions, orders",
    parameters: {
      type: "object",
      properties: {
        authority: { type: "string", description: "Wallet pubkey (optional)" },
      },
    },
  },
  {
    name: "perps_market_order",
    description: "Build unsigned market order instructions",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        side: { type: "string", enum: ["buy", "sell"], description: "Trade direction" },
        notionalUsd: { type: "number", description: "Order size in USD" },
        slippageBps: { type: "number", description: "Slippage tolerance in bps", default: 50 },
      },
      required: ["symbol", "side", "notionalUsd"],
    },
  },
  {
    name: "perps_limit_order",
    description: "Build unsigned limit order instructions",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        side: { type: "string", enum: ["buy", "sell"], description: "Trade direction" },
        priceUsd: { type: "number", description: "Limit price in USD" },
        tokens: { type: "number", description: "Size in base tokens" },
      },
      required: ["symbol", "side", "priceUsd", "tokens"],
    },
  },
  {
    name: "perps_stop_loss",
    description: "Build unsigned stop loss instructions",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        triggerPrice: { type: "number", description: "Trigger price in USD" },
        slippageBps: { type: "number", description: "Slippage once triggered in bps", default: 100 },
      },
      required: ["symbol", "triggerPrice"],
    },
  },
  {
    name: "perps_cancel_orders",
    description: "Cancel orders on a market",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Market symbol" },
        orderIds: { type: "array", items: { type: "string" }, description: "Order IDs to cancel (optional, cancels all if omitted)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "perps_deposit",
    description: "Build unsigned deposit instructions",
    parameters: {
      type: "object",
      properties: { amountUsd: { type: "number", description: "Amount in USDC" } },
      required: ["amountUsd"],
    },
  },
  {
    name: "perps_withdraw",
    description: "Build unsigned withdraw instructions",
    parameters: {
      type: "object",
      properties: { amountUsd: { type: "number", description: "Amount in USDC" } },
      required: ["amountUsd"],
    },
  },
  {
    name: "imperial_health",
    description: "Check Imperial Trading API health and configuration status",
    parameters: { type: "object", properties: {} },
  },
];

// ─── Tool Handlers ───────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; error?: string }>;

const HANDLERS: Record<string, ToolHandler> = {
  perps_list_markets: async () => {
    const r = await getRuntime();
    const markets = await r.listMarkets();
    return { ok: true, data: { count: markets.length, markets } };
  },
  perps_get_ticker: async (args) => {
    const r = await getRuntime();
    const data = await r.getTicker(String(args.symbol));
    return { ok: true, data };
  },
  perps_get_orderbook: async (args) => {
    const r = await getRuntime();
    const data = await r.getOrderbook(String(args.symbol), Number(args.depth ?? 20));
    return { ok: true, data };
  },
  perps_get_candles: async (args) => {
    const r = await getRuntime();
    const data = await r.getCandles(String(args.symbol), String(args.interval ?? "1h"), Number(args.limit ?? 20));
    return { ok: true, data };
  },
  perps_get_funding: async (args) => {
    const r = await getRuntime();
    const data = await r.getFundingRates(args.symbol ? String(args.symbol) : undefined);
    return { ok: true, data };
  },
  perps_get_market_stats: async (args) => {
    const r = await getRuntime();
    const data = await r.getMarketStats(String(args.symbol));
    return { ok: true, data };
  },
  perps_get_bbo: async (args) => {
    const r = await getRuntime();
    const data = await r.getBbo(String(args.symbol));
    return { ok: true, data };
  },
  perps_get_margin: async (args) => {
    const r = await getRuntime();
    const data = await r.getMarginStatus(args.authority ? String(args.authority) : undefined);
    return { ok: true, data };
  },
  perps_get_positions: async (args) => {
    const r = await getRuntime();
    const data = await r.getPositions(args.authority ? String(args.authority) : undefined);
    return { ok: true, data };
  },
  perps_get_trader_snapshot: async (args) => {
    const r = await getRuntime();
    const data = await r.getPortfolio(args.authority ? String(args.authority) : undefined);
    return { ok: true, data };
  },
  perps_market_order: async (args) => {
    const r = await getRuntime();
    const data = await r.executeMarketOrder({
      symbol: String(args.symbol),
      side: String(args.side) as "buy" | "sell",
      notionalUsd: Number(args.notionalUsd),
      slippageBps: args.slippageBps ? Number(args.slippageBps) : undefined,
    });
    return { ok: true, data };
  },
  perps_limit_order: async (args) => {
    const r = await getRuntime();
    const data = await r.executeLimitOrder({
      symbol: String(args.symbol),
      side: String(args.side) as "buy" | "sell",
      priceUsd: Number(args.priceUsd),
      tokens: Number(args.tokens),
    });
    return { ok: true, data };
  },
  perps_stop_loss: async (args) => {
    const r = await getRuntime();
    const data = await r.executeStopLoss({
      symbol: String(args.symbol),
      triggerPrice: Number(args.triggerPrice),
      slippageBps: args.slippageBps ? Number(args.slippageBps) : undefined,
    });
    return { ok: true, data };
  },
  perps_cancel_orders: async (args) => {
    const r = await getRuntime();
    const data = await r.executeCancel({
      symbol: String(args.symbol),
      orderIds: Array.isArray(args.orderIds) ? args.orderIds.map(String) : undefined,
    });
    return { ok: true, data };
  },
  perps_deposit: async (args) => {
    const r = await getRuntime();
    const data = await r.executeDeposit({ amountUsd: Number(args.amountUsd) });
    return { ok: true, data };
  },
  perps_withdraw: async (args) => {
    const r = await getRuntime();
    const data = await r.executeWithdraw({ amountUsd: Number(args.amountUsd) });
    return { ok: true, data };
  },
  imperial_health: async () => {
    const client = new ImperialClient();
    const data = await client.healthCheck();
    return { ok: true, data };
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check for Cloud Run / Google Agent Runtime
app.get("/health", async (_req, res) => {
  try {
    const r = await getRuntime();
    const health = await r.getRuntimeHealth();
    res.json({ status: "healthy", mode: health.mode, markets: health.trackedMarkets });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: error instanceof Error ? error.message : String(error) });
  }
});

// List available tools (MCP-compatible)
app.get("/agent/tools", async (_req, res) => {
  res.json({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) });
});

// Agent context metadata
app.get("/agent/context", async (_req, res) => {
  res.json({
    name: "clawd-perps-agent",
    version: "0.1.0",
    description: "Unified Solana perpetuals trading agent using Phoenix/Rise SDK",
    tools: TOOLS.map((t) => t.name),
  });
});

// Agent query endpoint (Google Agent Runtime compatible)
app.post("/agent:query", async (req, res) => {
  try {
    const { tool_name, tool_args } = req.body;

    if (!tool_name) {
      res.status(400).json({ ok: false, error: "Missing tool_name" });
      return;
    }

    const handler = HANDLERS[tool_name];
    if (!handler) {
      res.status(404).json({ ok: false, error: `Unknown tool: ${tool_name}` });
      return;
    }

    const result = await handler(tool_args ?? {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// Direct tool invocation
app.post("/agent/tool", async (req, res) => {
  const { name, arguments: args } = req.body;
  res.json(await HANDLERS[name]?.(args ?? {}) ?? { ok: false, error: `Unknown tool: ${name}` });
});

// OpenAPI spec
app.get("/openapi.json", async (_req, res) => {
  res.json({
    openapi: "3.0.0",
    info: { title: "Clawd Perps Agent", version: "0.1.0", description: "Solana perpetuals trading agent API" },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
      "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
      "/agent/tools": { get: { summary: "List tools", responses: { "200": { description: "Tool list" } } } },
      "/agent/tool": { post: { summary: "Execute tool", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, arguments: { type: "object" } } } } } }, responses: { "200": { description: "Tool result" } } } },
      "/agent:query": { post: { summary: "Query agent", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { tool_name: { type: "string" }, tool_args: { type: "object" } } } } } }, responses: { "200": { description: "Query result" } } } },
    },
  });
});

// Catch-all for tool calls routed via Google Agent Runtime
app.post("/", async (req, res) => {
  const { tool_name, tool_args } = req.body;
  if (tool_name) {
    const handler = HANDLERS[tool_name];
    if (handler) {
      res.json(await handler(tool_args ?? {}));
      return;
    }
  }
  res.json({ ok: true, message: "Clawd Perps Agent running", tools: TOOLS.map((t) => t.name) });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[ClawdPerpsAgent] Server listening on port ${PORT}`);
  console.log(`[ClawdPerpsAgent] ${TOOLS.length} tools available`);
});