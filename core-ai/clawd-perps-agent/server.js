import express from "express";
import cors from "cors";
import { loadClawdPerpsEnv } from "./src/env.js";
import { ClawdPerpsRuntime } from "./src/marketMaker.js";
import { loadPerpsRuntimeConfig } from "./src/config.js";
import { ImperialClient } from "./src/imperialAgent.js";
loadClawdPerpsEnv();
const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);
app.use(cors());
app.use(express.json());
let runtime;
async function getRuntime() {
    if (!runtime) {
        runtime = new ClawdPerpsRuntime(loadPerpsRuntimeConfig());
        await runtime.init();
    }
    return runtime;
}
// ── Tool Definitions ──
const TOOLS = [
    { name: "perps_list_markets", description: "List all available Phoenix perpetual markets with prices, funding, volume, spread", parameters: { type: "object", properties: {} } },
    { name: "perps_get_ticker", description: "Get current ticker for a perpetual market", parameters: { type: "object", properties: { symbol: { type: "string", description: "Market symbol (e.g. SOL, BTC, ETH)" } }, required: ["symbol"] } },
    { name: "perps_get_orderbook", description: "Get L2 orderbook for a perpetual market", parameters: { type: "object", properties: { symbol: { type: "string" }, depth: { type: "number", default: 20 } }, required: ["symbol"] } },
    { name: "perps_get_candles", description: "Get OHLCV candle history", parameters: { type: "object", properties: { symbol: { type: "string" }, interval: { type: "string", default: "1h" }, limit: { type: "number", default: 20 } }, required: ["symbol"] } },
    { name: "perps_get_funding", description: "Get current funding rates", parameters: { type: "object", properties: { symbol: { type: "string" } } } },
    { name: "perps_get_market_stats", description: "Get full market statistics", parameters: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
    { name: "perps_get_bbo", description: "Best bid/offer via on-chain Hawkeye simulation", parameters: { type: "object", properties: { symbol: { type: "string" } }, required: ["symbol"] } },
    { name: "perps_get_margin", description: "Margin status (collateral, maintenance margin, liquidation risk)", parameters: { type: "object", properties: { authority: { type: "string" } } } },
    { name: "perps_get_positions", description: "Open positions", parameters: { type: "object", properties: { authority: { type: "string" } } } },
    { name: "perps_get_trader_snapshot", description: "Full trader state with subaccounts", parameters: { type: "object", properties: { authority: { type: "string" } } } },
    { name: "perps_market_order", description: "Build unsigned market order instructions", parameters: { type: "object", properties: { symbol: { type: "string" }, side: { type: "string", enum: ["buy", "sell"] }, notionalUsd: { type: "number" }, slippageBps: { type: "number", default: 50 } }, required: ["symbol", "side", "notionalUsd"] } },
    { name: "perps_limit_order", description: "Build unsigned limit order instructions", parameters: { type: "object", properties: { symbol: { type: "string" }, side: { type: "string", enum: ["buy", "sell"] }, priceUsd: { type: "number" }, tokens: { type: "number" } }, required: ["symbol", "side", "priceUsd", "tokens"] } },
    { name: "perps_stop_loss", description: "Build unsigned stop loss instructions", parameters: { type: "object", properties: { symbol: { type: "string" }, triggerPrice: { type: "number" }, slippageBps: { type: "number", default: 100 } }, required: ["symbol", "triggerPrice"] } },
    { name: "perps_cancel_orders", description: "Cancel orders on a market", parameters: { type: "object", properties: { symbol: { type: "string" }, orderIds: { type: "array", items: { type: "string" } } }, required: ["symbol"] } },
    { name: "perps_deposit", description: "Build unsigned deposit instructions", parameters: { type: "object", properties: { amountUsd: { type: "number" } }, required: ["amountUsd"] } },
    { name: "perps_withdraw", description: "Build unsigned withdraw instructions", parameters: { type: "object", properties: { amountUsd: { type: "number" } }, required: ["amountUsd"] } },
    { name: "imperial_health", description: "Check Imperial Trading API health", parameters: { type: "object", properties: {} } },
];
const HANDLERS = {
    perps_list_markets: async () => { const r = await getRuntime(); const m = await r.listMarkets(); return { ok: true, data: { count: m.length, markets: m } }; },
    perps_get_ticker: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getTicker(String(a.symbol)) }; },
    perps_get_orderbook: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getOrderbook(String(a.symbol), Number(a.depth ?? 20)) }; },
    perps_get_candles: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getCandles(String(a.symbol), String(a.interval ?? "1h"), Number(a.limit ?? 20)) }; },
    perps_get_funding: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getFundingRates(a.symbol ? String(a.symbol) : undefined) }; },
    perps_get_market_stats: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getMarketStats(String(a.symbol)) }; },
    perps_get_bbo: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getBbo(String(a.symbol)) }; },
    perps_get_margin: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getMarginStatus(a.authority ? String(a.authority) : undefined) }; },
    perps_get_positions: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getPositions(a.authority ? String(a.authority) : undefined) }; },
    perps_get_trader_snapshot: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.getPortfolio(a.authority ? String(a.authority) : undefined) }; },
    perps_market_order: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeMarketOrder({ symbol: String(a.symbol), side: String(a.side), notionalUsd: Number(a.notionalUsd), slippageBps: a.slippageBps ? Number(a.slippageBps) : undefined }) }; },
    perps_limit_order: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeLimitOrder({ symbol: String(a.symbol), side: String(a.side), priceUsd: Number(a.priceUsd), tokens: Number(a.tokens) }) }; },
    perps_stop_loss: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeStopLoss({ symbol: String(a.symbol), triggerPrice: Number(a.triggerPrice), slippageBps: a.slippageBps ? Number(a.slippageBps) : undefined }) }; },
    perps_cancel_orders: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeCancel({ symbol: String(a.symbol), orderIds: Array.isArray(a.orderIds) ? a.orderIds.map(String) : undefined }) }; },
    perps_deposit: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeDeposit({ amountUsd: Number(a.amountUsd) }) }; },
    perps_withdraw: async (a) => { const r = await getRuntime(); return { ok: true, data: await r.executeWithdraw({ amountUsd: Number(a.amountUsd) }) }; },
    imperial_health: async () => { const c = new ImperialClient(); return { ok: true, data: await c.healthCheck() }; },
};
// ── Routes ──
app.get("/health", async (_r, res) => {
    try {
        const h = await (await getRuntime()).getRuntimeHealth();
        res.json({ status: "healthy", mode: h.mode, markets: h.trackedMarkets });
    }
    catch (e) {
        res.status(503).json({ status: "unhealthy", error: e instanceof Error ? e.message : String(e) });
    }
});
app.get("/agent/tools", (_r, res) => res.json({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }));
app.get("/agent/context", (_r, res) => res.json({ name: "clawd-perps-agent", version: "0.1.0", description: "Solana perpetuals agent", tools: TOOLS.map((t) => t.name) }));
app.post("/agent:query", async (req, res) => {
    try {
        const { tool_name, tool_args } = req.body;
        if (!tool_name) {
            res.status(400).json({ ok: false, error: "Missing tool_name" });
            return;
        }
        const h = HANDLERS[tool_name];
        if (!h) {
            res.status(404).json({ ok: false, error: `Unknown tool: ${tool_name}` });
            return;
        }
        res.json(await h(tool_args ?? {}));
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
});
app.post(["/agent/tool", "/"], async (req, res) => {
    const { name, arguments: args, tool_name, tool_args } = req.body;
    const n = name ?? tool_name;
    if (n && HANDLERS[n]) {
        res.json(await HANDLERS[n](args ?? tool_args ?? {}));
        return;
    }
    res.json({ ok: true, message: "Clawd Perps Agent running", tools: TOOLS.map((t) => t.name) });
});
app.get("/openapi.json", (_r, res) => res.json({
    openapi: "3.0.0", info: { title: "Clawd Perps Agent", version: "0.1.0" },
    servers: [{ url: `http://localhost:${PORT}` }],
    paths: {
        "/health": { get: { summary: "Health", responses: { "200": { description: "OK" } } } },
        "/agent/tools": { get: { summary: "Tools", responses: { "200": { description: "List" } } } },
        "/agent:query": { post: { summary: "Query", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { tool_name: { type: "string" }, tool_args: { type: "object" } } } } } }, responses: { "200": { description: "Result" } } } },
    },
}));
app.listen(PORT, () => console.log(`[ClawdPerpsAgent] ${PORT} | ${TOOLS.length} tools`));
//# sourceMappingURL=server.js.map