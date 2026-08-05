/**
 * Phoenix Rise SDK Adapter — direct @ellipsis-labs/rise integration
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createPhoenixClient,
  symbol,
  type PhoenixClient,
} from "@ellipsis-labs/rise";
import type { PerpsRuntimeConfig } from "../config.js";
import { redactSensitiveText } from "../redaction.js";

const execFileAsync = promisify(execFile);

// ─── Market View Types ───────────────────────────────────────────────────────

export interface PhoenixPerpMarketView {
  symbol: string;
  markPrice: number | null;
  midPrice: number | null;
  oraclePrice: number | null;
  fundingRate: number | null;
  annualizedFundingRate: number | null;
  openInterest: number | null;
  dayVolumeUsd: number | null;
  dayVolumeBase: number | null;
  status: string | null;
  source: "rise" | "vulcan";
  tickSize: number | null;
  baseLotsDecimals: number | null;
}

export interface PhoenixOrderbookLevel {
  price: number;
  size: number;
}

export interface PhoenixOrderbookSnapshot {
  symbol: string;
  bids: PhoenixOrderbookLevel[];
  asks: PhoenixOrderbookLevel[];
  timestamp: number;
  source: "rise" | "vulcan";
}

export interface PhoenixCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PhoenixMarginStatus {
  freeCollateralUsd: number;
  totalCollateralUsd: number;
  maintenanceMarginUsd: number;
  equityUsd: number;
  marginRatio: number;
  isLiquidatable: boolean;
  liquidationPriceUsd: number | null;
  source: "rise-hawkeye" | "rise-local" | "vulcan";
}

export interface PhoenixFundingRateView {
  symbol: string;
  currentFundingRate: number;
  eightHourFundingRate: number;
  annualizedFundingRate: number;
  timestamp: number;
  source: "rise" | "vulcan";
}

export interface PhoenixMarketStats {
  symbol: string;
  markPrice: number | null;
  oraclePrice: number | null;
  prevDayMarkPrice: number | null;
  dayVolumeUsd: number | null;
  dayVolumeBase: number | null;
  openInterest: number | null;
  currentFundingRate: number | null;
  eightHourFundingRate: number | null;
  annualizedFundingRate: number | null;
  timestamp: number | null;
  source: "rise" | "vulcan";
}

export interface PhoenixTraderPosition {
  symbol: string;
  side: "long" | "short" | "neutral";
  sizeTokens: number;
  entryPrice: number | null;
  markPrice: number | null;
  unrealizedPnlUsd: number | null;
  liquidationPriceUsd: number | null;
  subaccountIndex: number;
}

export interface PhoenixTraderSnapshot {
  authority: string;
  subaccounts: {
    subaccountIndex: number;
    collateralUsd: number;
    positions: PhoenixTraderPosition[];
    orderCount: number;
  }[];
  source: "rise" | "vulcan";
}

// ─── Adapter Interface ───────────────────────────────────────────────────────

export interface PhoenixRiseAdapter {
  connect(): Promise<void>;
  disconnect(): void;
  health(): Promise<unknown>;
  listMarkets(): Promise<PhoenixPerpMarketView[]>;
  getTicker(symbol?: string): Promise<unknown>;
  getOrderbook(symbol: string, depth?: number): Promise<PhoenixOrderbookSnapshot>;
  getCandles(symbol: string, interval?: string, limit?: number): Promise<PhoenixCandle[]>;
  getMarketStats(symbol: string): Promise<PhoenixMarketStats>;
  getFundingRates(symbol?: string): Promise<PhoenixFundingRateView[]>;
  getTraderSnapshot(authority?: string): Promise<PhoenixTraderSnapshot>;
  getPositions(authority?: string): Promise<unknown>;
  getMarginStatus(authority: string, subaccountIndex?: number): Promise<PhoenixMarginStatus>;
  getLiquidationPrice(authority: string, symbol: string, subaccountIndex?: number): Promise<number | null>;
  getBbo(s: string): Promise<{ bid: number | null; ask: number | null; mark: number | null }>;
  getExchangeReady(): Promise<boolean>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSymbol(s: string): string { return s.trim().toUpperCase(); }
function errMsg(e: unknown): string { return e instanceof Error ? e.message : String(e); }

// ─── Vulcan CLI Fallback ─────────────────────────────────────────────────────

interface VulcanJsonEnvelope<T> { ok?: boolean; data?: T; error?: { message?: string } | string; }

async function runVulcanJson<T>(config: PerpsRuntimeConfig, label: string, args: string[]): Promise<T> {
  const ga = [...(config.rpcUrl ? ["--rpc-url", config.rpcUrl] : []), ...(config.apiUrl ? ["--api-url", config.apiUrl] : [])];
  try {
    const { stdout } = await execFileAsync("vulcan", [...ga, ...args, "-o", "json"], { timeout: 20000, env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 10 * 1024 * 1024 });
    const p = JSON.parse(stdout) as VulcanJsonEnvelope<T>;
    if (p.ok === false) throw new Error(typeof p.error === "string" ? p.error : p.error?.message ?? `${label} failed`);
    return (p.data ?? p) as T;
  } catch (error: unknown) {
    const me = error as { stdout?: unknown; stderr?: unknown; code?: unknown };
    if (typeof me.stdout === "string" && me.stdout.trim()) {
      try { const p = JSON.parse(me.stdout) as VulcanJsonEnvelope<T>; if (p?.ok === false) throw new Error(typeof p.error === "string" ? p.error : p.error?.message ?? `${label} failed`); } catch { /* skip */ }
    }
    throw new Error(`${label}: vulcan exited` + (typeof me.stderr === "string" ? `: ${redactSensitiveText(me.stderr.trim()).split("\n")[0]}` : ""));
  }
}

function normalizeVulcanMarket(m: Record<string, unknown>): PhoenixPerpMarketView {
  return { symbol: String(m.symbol ?? "").toUpperCase(), markPrice: typeof m.mark_price === "number" ? m.mark_price : null, midPrice: null, oraclePrice: null, fundingRate: typeof m.funding_rate === "number" ? m.funding_rate : null, annualizedFundingRate: null, openInterest: typeof m.open_interest === "number" ? m.open_interest : null, dayVolumeUsd: null, dayVolumeBase: null, status: typeof m.status === "string" ? m.status : null, source: "vulcan", tickSize: null, baseLotsDecimals: null };
}

// ─── Adapter Class ───────────────────────────────────────────────────────────

export class ClawdPhoenixRiseAdapter implements PhoenixRiseAdapter {
  private client: PhoenixClient | null = null;
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly config: PerpsRuntimeConfig) {}

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = (async () => {
      try {
        this.client = createPhoenixClient({
          apiUrl: this.config.apiUrl || "https://perp-api.phoenix.trade",
          rpcUrl: this.config.rpcUrl || "https://api.mainnet-beta.solana.com",
          ws: { connectMode: "eager" },
          exchangeMetadata: { stream: true },
        });
        await this.client.exchange.ready();
        this.connected = true;
      } catch { this.connected = false; this.client = null; }
    })();
    return this.connectPromise;
  }

  disconnect(): void { this.connected = false; this.client = null; }
  async getExchangeReady(): Promise<boolean> { if (this.connected && this.client) return true; try { await this.connect(); return this.connected; } catch { return false; } }

  private async listRiseMarkets(): Promise<PhoenixPerpMarketView[] | null> {
    if (!this.client || !this.connected) return null;
    try {
      // Prefer exchange cache
      const symbols = (() => {
        try {
          const state = (this.client!.exchange as any).cacheStore?.getState?.();
          return state?.marketsBySymbol ? Object.keys(state.marketsBySymbol) : [];
        } catch { return []; }
      })();

      if (symbols.length > 0) {
        const md = this.client.marketData();
        return symbols.map((sym) => {
          const row = md.market(sym);
          const mkt = this.client!.exchange.market(sym);
          return {
            symbol: sym, markPrice: row?.markPrice ?? null, midPrice: row?.mid ?? null,
            oraclePrice: row?.oraclePrice ?? null, fundingRate: row?.currentFundingRate ?? null,
            annualizedFundingRate: row?.annualizedFundingRate ?? null, openInterest: row?.openInterest ?? null,
            dayVolumeUsd: row?.dayVolumeUsd ?? null, dayVolumeBase: row?.dayVolumeBase ?? null,
            status: mkt?.marketStatus ?? null, source: "rise", tickSize: mkt?.tickSize ?? null,
            baseLotsDecimals: mkt?.baseLotsDecimals ?? null,
          };
        });
      }

      // Fall back to REST API (no exchange cache needed)
      const configs = await this.client.api.exchange().getMarkets();
      const md = this.client.marketData();
      return configs.map((cfg: { symbol: string; marketStatus?: string; tickSize?: number; baseLotsDecimals?: number; assetId?: number }) => {
        const row = md.market(cfg.symbol);
        return {
          symbol: cfg.symbol, markPrice: row?.markPrice ?? null, midPrice: row?.mid ?? null,
          oraclePrice: row?.oraclePrice ?? null, fundingRate: row?.currentFundingRate ?? null,
          annualizedFundingRate: row?.annualizedFundingRate ?? null, openInterest: row?.openInterest ?? null,
          dayVolumeUsd: row?.dayVolumeUsd ?? null, dayVolumeBase: row?.dayVolumeBase ?? null,
          status: cfg.marketStatus ?? null, source: "rise", tickSize: cfg.tickSize ?? null,
          baseLotsDecimals: cfg.baseLotsDecimals ?? null,
        };
      });
    } catch { return null; }
  }

  // ── Market Data ──

  async listMarkets(): Promise<PhoenixPerpMarketView[]> {
    // Try Rise SDK (cache + REST fallback)
    const riseMarkets = await this.listRiseMarkets();
    if (riseMarkets) return riseMarkets;

    // Vulcan CLI fallback
    const data = await runVulcanJson<{ markets?: Array<Record<string, unknown>> }>(this.config, "vulcan market list", ["market", "list"]);
    return (data.markets ?? []).map(normalizeVulcanMarket).filter((m) => m.symbol);
  }

  async getTicker(sym?: string): Promise<unknown> {
    if (this.connected && this.client) {
      try {
        if (sym) {
          const s = normalizeSymbol(sym);
          const row = this.client.marketData().market(s);
          const mkt = this.client.exchange.market(s);
          return { symbol: s, markPrice: row?.markPrice ?? null, mid: row?.mid ?? null, oraclePrice: row?.oraclePrice ?? null, fundingRate: row?.currentFundingRate ?? null, annualizedFundingRate: row?.annualizedFundingRate ?? null, openInterest: row?.openInterest ?? null, dayVolumeUsd: row?.dayVolumeUsd ?? null, dayVolumeBase: row?.dayVolumeBase ?? null, tickSize: mkt?.tickSize ?? null, source: "rise" };
        }
        return this.listMarkets();
      } catch { /* fall through */ }
    }
    if (!sym) return this.listMarkets();
    return runVulcanJson(this.config, "vulcan market ticker", ["market", "ticker", normalizeSymbol(sym)]);
  }

  async getOrderbook(sym: string, depth = 20): Promise<PhoenixOrderbookSnapshot> {
    const s = normalizeSymbol(sym);
    if (this.connected && this.client) {
      try {
        const ob = await this.client.api.orderbook().getOrderbook(s);
        return {
          symbol: s,
          bids: (ob.bids ?? []).slice(0, depth).map((b: [number, number]) => ({ price: b[0], size: b[1] })),
          asks: (ob.asks ?? []).slice(0, depth).map((a: [number, number]) => ({ price: a[0], size: a[1] })),
          timestamp: Date.now(), source: "rise",
        };
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<{ bids?: [number, number][]; asks?: [number, number][] }>(this.config, "vulcan market orderbook", ["market", "orderbook", s, "--depth", String(depth)]);
    return { symbol: s, bids: (d.bids ?? []).slice(0, depth).map((b) => ({ price: b[0], size: b[1] })), asks: (d.asks ?? []).slice(0, depth).map((a) => ({ price: a[0], size: a[1] })), timestamp: Date.now(), source: "vulcan" };
  }

  async getCandles(sym: string, interval = "1h", limit = 20): Promise<PhoenixCandle[]> {
    const s = normalizeSymbol(sym);
    if (this.connected && this.client) {
      try {
        const cs = await this.client.api.candles().getCandles(s, { timeframe: interval, limit });
        return (cs ?? []).map((c: { time: number; open: number; high: number; low: number; close: number; volume: number }) => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<{ candles?: PhoenixCandle[] }>(this.config, "vulcan market candles", ["market", "candles", s, "--interval", interval, "--limit", String(limit)]);
    return (d.candles ?? []).map((c) => ({ timestamp: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  }

  async getFundingRates(sym?: string): Promise<PhoenixFundingRateView[]> {
    if (this.connected && this.client) {
      try {
        const md = this.client.marketData();
        const symbols = sym ? [normalizeSymbol(sym)] : (await this.listMarkets()).map((m) => m.symbol);
        return symbols.map((s) => {
          const row = md.market(s);
          return { symbol: s, currentFundingRate: row?.currentFundingRate ?? 0, eightHourFundingRate: row?.eightHourFundingRate ?? 0, annualizedFundingRate: row?.annualizedFundingRate ?? 0, timestamp: Date.now(), source: "rise" };
        });
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<{ funding_rates?: Array<Record<string, unknown>> }>(this.config, "vulcan market funding-rates", ["market", "funding-rates"]);
    return (d.funding_rates ?? []).filter((r) => !sym || String(r.symbol ?? "").toUpperCase() === normalizeSymbol(sym)).map((r) => ({
      symbol: String(r.symbol ?? "").toUpperCase(), currentFundingRate: Number(r.funding_rate ?? 0),
      eightHourFundingRate: Number(r.eight_hour_rate ?? Number(r.funding_rate ?? 0) * 8),
      annualizedFundingRate: Number(r.annualized_rate ?? Number(r.funding_rate ?? 0) * 8760),
      timestamp: Number(r.timestamp ?? Date.now()), source: "vulcan",
    }));
  }

  async getMarketStats(sym: string): Promise<PhoenixMarketStats> {
    const s = normalizeSymbol(sym);
    if (this.connected && this.client) {
      try {
        const row = this.client.marketData().market(s);
        return { symbol: s, markPrice: row?.markPrice ?? null, oraclePrice: row?.oraclePrice ?? null, prevDayMarkPrice: row?.prevDayMarkPrice ?? null, dayVolumeUsd: row?.dayVolumeUsd ?? null, dayVolumeBase: row?.dayVolumeBase ?? null, openInterest: row?.openInterest ?? null, currentFundingRate: row?.currentFundingRate ?? null, eightHourFundingRate: row?.eightHourFundingRate ?? null, annualizedFundingRate: row?.annualizedFundingRate ?? null, timestamp: row?.timestamp ?? null, source: "rise" };
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<Record<string, unknown>>(this.config, "vulcan market ticker", ["market", "ticker", s]);
    return { symbol: s, markPrice: typeof d.mark_price === "number" ? d.mark_price : null, oraclePrice: null, prevDayMarkPrice: null, dayVolumeUsd: typeof d.day_volume === "number" ? d.day_volume : null, dayVolumeBase: null, openInterest: typeof d.open_interest === "number" ? d.open_interest : null, currentFundingRate: typeof d.funding_rate === "number" ? d.funding_rate : null, eightHourFundingRate: null, annualizedFundingRate: typeof d.funding_rate === "number" ? (d.funding_rate as number) * 8760 : null, timestamp: Date.now(), source: "vulcan" };
  }

  // ── BBO ──

  async getBbo(sym: string): Promise<{ bid: number | null; ask: number | null; mark: number | null }> {
    const s = normalizeSymbol(sym);
    if (this.connected && this.client) {
      try {
        const bbo = await this.client.rpc.hawkeye.viewBbo({ symbol: symbol(s) });
        const d = bbo.returnData?.decoded;
        if (d) return { bid: d.bestBidTicks !== null ? Number(d.bestBidTicks) / 1_000_000 : null, ask: d.bestAskTicks !== null ? Number(d.bestAskTicks) / 1_000_000 : null, mark: Number(d.markPriceTicks) / 1_000_000 };
      } catch { /* fall through */ }
      try {
        const row = this.client.marketData().market(s);
        return { bid: row?.mid ?? null, ask: row?.mid ?? null, mark: row?.markPrice ?? null };
      } catch { /* fall through */ }
    }
    const ob = await this.getOrderbook(s, 1);
    return { bid: ob.bids[0]?.price ?? null, ask: ob.asks[0]?.price ?? null, mark: null };
  }

  // ── Trader Data ──

  async getTraderSnapshot(authority?: string): Promise<PhoenixTraderSnapshot> {
    const auth = authority || this.config.wallet || "unknown";
    if (this.connected && this.client) {
      try {
        const ts = await this.client.api.traders().getTraderStateSnapshot(auth, { traderPdaIndex: this.config.traderPdaIndex });
        const subaccounts = (ts.snapshot.subaccounts ?? []).map((sa: any) => {
          const positions: PhoenixTraderPosition[] = (sa.positions ?? []).map((p: any) => {
            const lots = BigInt(p.basePositionLots ?? "0");
            return { symbol: p.symbol, side: lots > 0n ? "long" : lots < 0n ? "short" : "neutral", sizeTokens: Number(lots) / 1_000_000, entryPrice: null, markPrice: null, unrealizedPnlUsd: null, liquidationPriceUsd: null, subaccountIndex: sa.subaccountIndex };
          });
          return { subaccountIndex: sa.subaccountIndex, collateralUsd: Number(sa.collateral ?? 0) / 1_000_000, positions, orderCount: (sa.orderIds ?? []).length };
        });
        return { authority: auth, subaccounts, source: "rise" };
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<Record<string, unknown>>(this.config, "vulcan portfolio", ["portfolio"]);
    return { authority: auth, subaccounts: [{ subaccountIndex: 0, collateralUsd: typeof d.collateral === "number" ? d.collateral / 1_000_000 : 0, positions: [], orderCount: 0 }], source: "vulcan" };
  }

  async getPositions(authority?: string): Promise<unknown> {
    if (this.connected && this.client) { try { return (await this.getTraderSnapshot(authority)).subaccounts.flatMap((sa) => sa.positions); } catch { /* fall through */ } }
    return runVulcanJson(this.config, "vulcan position list", ["position", "list"]);
  }

  // ── Margin ──

  async getMarginStatus(authority: string, subaccountIndex = 0): Promise<PhoenixMarginStatus> {
    if (this.connected && this.client) {
      try {
        const mr = await this.client.rpc.hawkeye.viewMargin({ authority: authority as any, traderPdaIndex: this.config.traderPdaIndex, traderSubaccountIndex: subaccountIndex });
        const d = mr.returnData?.decoded;
        if (d) {
          const total = Number(d.collateralQuoteLots) / 1_000_000;
          const free = Number(d.freeCollateralQuoteLots) / 1_000_000;
          const maint = Number(d.maintenanceMarginQuoteLots) / 1_000_000;
          return { freeCollateralUsd: free, totalCollateralUsd: total, maintenanceMarginUsd: maint, equityUsd: total - maint, marginRatio: total > 0 ? maint / total : 0, isLiquidatable: d.isLiquidatable, liquidationPriceUsd: null, source: "rise-hawkeye" };
        }
      } catch { /* fall through */ }
    }
    const d = await runVulcanJson<Record<string, unknown>>(this.config, "vulcan margin status", ["margin", "status"]);
    return { freeCollateralUsd: typeof d.free_collateral === "number" ? d.free_collateral / 1_000_000 : 0, totalCollateralUsd: typeof d.total_collateral === "number" ? d.total_collateral / 1_000_000 : 0, maintenanceMarginUsd: typeof d.maintenance_margin === "number" ? d.maintenance_margin / 1_000_000 : 0, equityUsd: 0, marginRatio: 0, isLiquidatable: false, liquidationPriceUsd: null, source: "vulcan" };
  }

  async getLiquidationPrice(authority: string, sym: string, subaccountIndex = 0): Promise<number | null> {
    const s = normalizeSymbol(sym);
    if (this.connected && this.client) {
      try {
        const liq = await this.client.rpc.hawkeye.viewLiquidationPrice({ authority: authority as any, traderPdaIndex: this.config.traderPdaIndex, traderSubaccountIndex: subaccountIndex, symbol: symbol(s) });
        const d = liq.returnData?.decoded;
        if (d) return Number(d.liquidationPriceTicks) / 1_000_000;
      } catch { /* fall through */ }
    }
    return null;
  }

  async health(): Promise<unknown> {
    if (this.connected && this.client) {
      try { return { ok: true, source: "rise", markets: (await this.listMarkets()).length, connected: true }; }
      catch (e) { return { ok: true, source: "vulcan", primary: { ok: false, source: "rise", error: errMsg(e) }, data: await this._vulcanHealth() }; }
    }
    return { ok: true, source: "vulcan", data: await this._vulcanHealth() };
  }

  private async _vulcanHealth(): Promise<unknown> { try { return await runVulcanJson(this.config, "vulcan status", ["status"]); } catch { return { ok: false, error: "Vulcan CLI not available" }; } }
}

export function createPhoenixRiseAdapter(config: PerpsRuntimeConfig): PhoenixRiseAdapter {
  return new ClawdPhoenixRiseAdapter(config);
}