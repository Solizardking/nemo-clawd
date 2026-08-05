/**
 * Rise SDK Order Executor — builds Phoenix order instructions using @ellipsis-labs/rise
 */

import {
  createPhoenixClient,
  symbol,
  Side,
} from "@ellipsis-labs/rise";
import type { PerpsRuntimeConfig } from "../config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiseOrderInstruction {
  data: string;
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
}

export interface RiseExecutionPlan {
  ok: boolean;
  mode: "observe" | "paper" | "live";
  description: string;
  instructions: RiseOrderInstruction[];
  risk: {
    estimatedPrice: number | null;
    estimatedSlippage: number | null;
    postTradeLiquidationPrice: number | null;
    marginCheck: "pass" | "warn" | "fail";
    warnings: string[];
  };
  blocking: string[];
}

export interface RiseMarketOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  notionalUsd: number;
  slippageBps?: number;
  subaccountIndex?: number;
}

export interface RiseLimitOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  priceUsd: number;
  tokens: number;
  subaccountIndex?: number;
}

export interface RiseStopLossRequest {
  symbol: string;
  triggerPrice: number;
  slippageBps?: number;
  subaccountIndex?: number;
}

export interface RiseCancelRequest {
  symbol: string;
  orderIds?: string[];
  subaccountIndex?: number;
}

export interface RiseCollateralRequest {
  amountUsd: number;
  subaccountIndex?: number;
}

// ─── Order Executor ──────────────────────────────────────────────────────────

export class RiseOrderExecutor {
  private client: ReturnType<typeof createPhoenixClient> | null = null;
  private connected = false;

  constructor(private readonly config: PerpsRuntimeConfig) {}

  async connect(): Promise<void> {
    if (this.connected && this.client) return;
    this.client = createPhoenixClient({
      apiUrl: this.config.apiUrl || "https://perp-api.phoenix.trade",
      rpcUrl: this.config.rpcUrl || "https://api.mainnet-beta.solana.com",
      ws: { connectMode: "lazy" },
      exchangeMetadata: { stream: false },
    });
    await this.client.exchange.ready();
    this.connected = true;
  }

  private ensureClient() {
    if (!this.client || !this.connected) throw new Error("RiseOrderExecutor not connected");
    return this.client;
  }

  // ── Market Order ──

  async buildMarketOrder(req: RiseMarketOrderRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const blocking: string[] = [];
    const warnings: string[] = [];
    const sym = req.symbol.trim().toUpperCase();

    if (!this.config.liveTrading || this.config.simOnly) {
      blocking.push("Live trading not enabled");
    }

    const market = client.exchange.market(sym);
    if (!market) {
      blocking.push(`Unknown market: ${sym}`);
      return { ok: false, mode: "observe", description: `Blocked: ${sym} not found`, instructions: [], risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "fail", warnings }, blocking };
    }

    const row = client.marketData().market(sym);
    const markPrice = row?.markPrice ?? null;
    if (!markPrice) warnings.push("No mark price available");

    const slippageBps = req.slippageBps ?? 50;
    const estimatedPrice = markPrice ?? 0;
    const baseUnits = req.notionalUsd / (estimatedPrice || 1);
    const side = req.side === "buy" ? Side.Bid : Side.Ask;

    try {
      const orderPacket = await client.orderPackets.buildMarketOrderPacket({
        symbol: sym,
        side,
        baseUnits: String(baseUnits),
      });

      const placeMarketIx = await client.ixs.buildPlaceMarketOrder({
        authority: this.getAuthority(),
        symbol: symbol(sym) as any,
        orderPacket,
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });

      const instructions = [this.normalizeIx(placeMarketIx)];

      return {
        ok: blocking.length === 0,
        mode: this.config.liveTrading ? "live" : "paper",
        description: `${req.side.toUpperCase()} ${req.notionalUsd} USD ${sym}`,
        instructions,
        risk: { estimatedPrice, estimatedSlippage: slippageBps / 10000, postTradeLiquidationPrice: null, marginCheck: blocking.length > 0 ? "fail" : "pass", warnings },
        blocking,
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: this.config.liveTrading ? "live" : "paper", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice, estimatedSlippage: slippageBps / 10000, postTradeLiquidationPrice: null, marginCheck: "fail", warnings }, blocking };
    }
  }

  // ── Limit Order ──

  async buildLimitOrder(req: RiseLimitOrderRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const blocking: string[] = [];
    const warnings: string[] = [];
    const sym = req.symbol.trim().toUpperCase();

    if (!this.config.liveTrading || this.config.simOnly) blocking.push("Live trading not enabled");

    if (!client.exchange.market(sym)) {
      blocking.push(`Unknown market: ${sym}`);
      return { ok: false, mode: "observe", description: `Blocked: ${sym} not found`, instructions: [], risk: { estimatedPrice: req.priceUsd, estimatedSlippage: 0, postTradeLiquidationPrice: null, marginCheck: "fail", warnings }, blocking };
    }

    const side = req.side === "buy" ? Side.Bid : Side.Ask;

    try {
      const orderPacket = await client.orderPackets.buildLimitOrderPacket({
        symbol: sym,
        side,
        priceUsd: String(req.priceUsd),
        baseUnits: String(req.tokens),
      });

      const placeLimitIx = await client.ixs.buildPlaceLimitOrder({
        authority: this.getAuthority(),
        symbol: symbol(sym) as any,
        orderPacket,
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });

      return {
        ok: blocking.length === 0,
        mode: this.config.liveTrading ? "live" : "paper",
        description: `LIMIT ${req.side.toUpperCase()} ${req.tokens} ${sym} @ $${req.priceUsd}`,
        instructions: [this.normalizeIx(placeLimitIx)],
        risk: { estimatedPrice: req.priceUsd, estimatedSlippage: 0, postTradeLiquidationPrice: null, marginCheck: blocking.length > 0 ? "fail" : "pass", warnings },
        blocking,
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: this.config.liveTrading ? "live" : "paper", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice: req.priceUsd, estimatedSlippage: 0, postTradeLiquidationPrice: null, marginCheck: "fail", warnings }, blocking };
    }
  }

  // ── Stop Loss ──

  async buildStopLoss(req: RiseStopLossRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const blocking: string[] = [];
    const warnings: string[] = [];
    const sym = req.symbol.trim().toUpperCase();

    if (!this.config.liveTrading || this.config.simOnly) blocking.push("Live trading not enabled");

    try {
      // Check current position to determine trade side
      const traderState = await client.api.traders().getTraderStateSnapshot(this.config.wallet ?? "", { traderPdaIndex: this.config.traderPdaIndex });
      const subaccount = traderState.snapshot.subaccounts[req.subaccountIndex ?? 0];
      const position = subaccount?.positions?.find((p: { symbol: string }) => p.symbol === sym);
      const baseLots = BigInt(position?.basePositionLots ?? "0");

      const slipBps = req.slippageBps ?? 100;
      const stopLossIx = await client.ixs.buildPlaceStopLoss({
        authority: this.getAuthority(),
        symbol: symbol(sym) as any,
        triggerPrice: BigInt(Math.round(req.triggerPrice * 1_000_000)),
        slippageBps: slipBps,
        tradeSide: baseLots > 0n ? Side.Ask : Side.Bid,
        executionDirection: 1 as 0 | 1,
        orderKind: 0 as 0 | 1,
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });

      const direction = baseLots > 0n ? "SELL" : "BUY";
      return {
        ok: blocking.length === 0,
        mode: this.config.liveTrading ? "live" : "paper",
        description: `STOP LOSS ${direction} ${sym} @ $${req.triggerPrice}`,
        instructions: [this.normalizeIx(stopLossIx)],
        risk: { estimatedPrice: req.triggerPrice, estimatedSlippage: slipBps / 10000, postTradeLiquidationPrice: null, marginCheck: blocking.length > 0 ? "fail" : "pass", warnings },
        blocking,
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: this.config.liveTrading ? "live" : "paper", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice: req.triggerPrice, estimatedSlippage: 0, postTradeLiquidationPrice: null, marginCheck: "fail", warnings }, blocking };
    }
  }

  // ── Cancel ──

  async buildCancel(req: RiseCancelRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const sym = req.symbol.trim().toUpperCase();
    const blocking: string[] = [];

    try {
      if (req.orderIds && req.orderIds.length > 0) {
        const cancelIx = await client.ixs.buildCancelOrdersById({
          authority: this.getAuthority(),
          symbol: symbol(sym) as any,
          orders: req.orderIds.map((id) => ({ price: 0n, orderSequenceNumber: id })),
          traderPdaIndex: this.config.traderPdaIndex,
          traderSubaccountIndex: req.subaccountIndex ?? 0,
        });
        return {
          ok: true, mode: "live",
          description: `CANCEL ${req.orderIds.length} orders on ${sym}`,
          instructions: [this.normalizeIx(cancelIx)],
          risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "pass", warnings: [] },
          blocking: [],
        };
      }

      const cancelAllIx = await client.ixs.buildCancelAll({
        authority: this.getAuthority(),
        symbol: symbol(sym) as any,
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });
      return {
        ok: true, mode: "live",
        description: `CANCEL ALL orders on ${sym}`,
        instructions: [this.normalizeIx(cancelAllIx)],
        risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "pass", warnings: [] },
        blocking: [],
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: "observe", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "fail", warnings: [] }, blocking };
    }
  }

  // ── Collateral ──

  async buildDepositCollateral(req: RiseCollateralRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const blocking: string[] = [];

    try {
      const result = await client.ixs.buildDepositIxs({
        authority: this.getAuthority(),
        amount: BigInt(Math.round(req.amountUsd * 1_000_000)),
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });
      const instructions = [this.normalizeIx(result.named.depositFunds)];
      return {
        ok: true, mode: "live",
        description: `DEPOSIT $${req.amountUsd} USDC`,
        instructions,
        risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "pass", warnings: [] },
        blocking: [],
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: "observe", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "fail", warnings: [] }, blocking };
    }
  }

  async buildWithdrawCollateral(req: RiseCollateralRequest): Promise<RiseExecutionPlan> {
    const client = this.ensureClient();
    const blocking: string[] = [];

    try {
      const result = await client.ixs.buildWithdrawIxs({
        authority: this.getAuthority(),
        amount: BigInt(Math.round(req.amountUsd * 1_000_000)),
        traderPdaIndex: this.config.traderPdaIndex,
        traderSubaccountIndex: req.subaccountIndex ?? 0,
      });
      const instructions = [this.normalizeIx(result.named.withdrawFunds)];
      return {
        ok: true, mode: "live",
        description: `WITHDRAW $${req.amountUsd} USDC`,
        instructions,
        risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "pass", warnings: [] },
        blocking: [],
      };
    } catch (error: unknown) {
      blocking.push(error instanceof Error ? error.message : String(error));
      return { ok: false, mode: "observe", description: `Failed: ${error instanceof Error ? error.message : String(error)}`, instructions: [], risk: { estimatedPrice: null, estimatedSlippage: null, postTradeLiquidationPrice: null, marginCheck: "fail", warnings: [] }, blocking };
    }
  }

  // ── Helpers ──

  private getAuthority(): any {
    if (!this.config.wallet) throw new Error("No wallet configured");
    return this.config.wallet as any;
  }

  private normalizeIx(ix: any): RiseOrderInstruction {
    return {
      data: typeof ix.data === "string" ? ix.data : Array.isArray(ix.data) ? Buffer.from(ix.data as number[]).toString("base64") : String(ix.data ?? ""),
      programId: String(ix.programId ?? ix.programAddress ?? ix.program_id ?? ""),
      accounts: Array.isArray(ix.accounts) ? ix.accounts.map((a: any) => ({
        pubkey: String(a.pubkey ?? ""),
        isSigner: Boolean(a.isSigner ?? a.is_signer ?? false),
        isWritable: Boolean(a.isWritable ?? a.is_writable ?? false),
      })) : [],
    };
  }
}

export function createRiseOrderExecutor(config: PerpsRuntimeConfig): RiseOrderExecutor {
  return new RiseOrderExecutor(config);
}