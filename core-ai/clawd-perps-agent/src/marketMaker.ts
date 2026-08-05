import {
  buildPreflightReport,
  loadPerpsRuntimeConfig,
  resolveTradingMode,
  type PerpsRuntimeConfig,
  type PreflightReport,
} from "./config.js";
import { createPhoenixRiseAdapter, type PhoenixRiseAdapter, type PhoenixOrderbookSnapshot, type PhoenixCandle, type PhoenixMarginStatus, type PhoenixFundingRateView, type PhoenixMarketStats, type PhoenixTraderSnapshot } from "./adapters/phoenixRise.js";
import { createRiseOrderExecutor, type RiseOrderExecutor, type RiseExecutionPlan, type RiseMarketOrderRequest, type RiseLimitOrderRequest, type RiseStopLossRequest, type RiseCancelRequest, type RiseCollateralRequest } from "./adapters/riseOrderExecutor.js";
import {
  buildVulcanExecutionPlan,
  type VulcanExecutionIntent,
  type VulcanExecutionPlan,
} from "./adapters/vulcan.js";
import { errorMessage } from "./errors.js";
import { resolveClawdRepoRoot } from "./paths.js";
import { summarizeVulcanCatalog } from "./vulcanCatalog.js";

export interface MarketMakerIntent {
  symbol: string;
  mode: "observe" | "quote" | "paper" | "live";
  maxNotionalUsd: number;
  maxSpreadBps: number;
}

export interface MarketMakerStatus {
  armed: boolean;
  mode: "observe" | "paper" | "live";
  symbol: string;
  notes: string[];
}

export interface TraderActionPreview {
  symbol: string;
  side: "buy" | "sell";
  notionalUsd: number;
  execution: "observe" | "paper" | "rise-live" | "vulcan-live";
  preflight: PreflightReport;
  route: {
    adapter: "rise" | "vulcan";
    action: string;
    payload: unknown;
  };
}

export class ClawdPerpsRuntime {
  readonly rise: PhoenixRiseAdapter;
  readonly executor: RiseOrderExecutor;

  constructor(
    readonly config: PerpsRuntimeConfig = loadPerpsRuntimeConfig(),
    readonly repoRoot = resolveClawdRepoRoot(process.cwd(), import.meta.url),
  ) {
    this.rise = createPhoenixRiseAdapter(config);
    this.executor = createRiseOrderExecutor(config);
  }

  async init(): Promise<void> {
    try {
      await this.rise.connect();
    } catch {
      // Rise SDK init is best-effort; Vulcan fallback will be used
    }
    try {
      await this.executor.connect();
    } catch {
      // Executor init is best-effort; used on demand
    }
  }

  createStatus(intent: MarketMakerIntent): MarketMakerStatus {
    const mode = resolveTradingMode(this.config);
    return {
      armed: mode === "live",
      mode,
      symbol: intent.symbol.toUpperCase(),
      notes: [
        "Rise SDK is the source of truth for market reads and unsigned instruction building.",
        "Hawkeye RPC provides authoritative on-chain margin, liquidation, and BBO views.",
        "Vulcan remains available for paper execution and CLI compatibility.",
        "Live routes are blocked unless preflight, operator confirmation, and non-sim mode all pass.",
      ],
    };
  }

  // ── Market Data ──

  async listMarkets() {
    return this.rise.listMarkets();
  }

  async getTicker(symbol?: string) {
    return this.rise.getTicker(symbol);
  }

  async getOrderbook(symbol: string, depth = 20): Promise<PhoenixOrderbookSnapshot> {
    return this.rise.getOrderbook(symbol, depth);
  }

  async getCandles(symbol: string, interval = "1h", limit = 20): Promise<PhoenixCandle[]> {
    return this.rise.getCandles(symbol, interval, limit);
  }

  async getMarketStats(symbol: string): Promise<PhoenixMarketStats> {
    return this.rise.getMarketStats(symbol);
  }

  async getFundingRates(symbol?: string): Promise<PhoenixFundingRateView[]> {
    return this.rise.getFundingRates(symbol);
  }

  async getBbo(symbol: string): Promise<{ bid: number | null; ask: number | null; mark: number | null }> {
    return this.rise.getBbo(symbol);
  }

  // ── Trader Data ──

  async getPositions(authority?: string) {
    return this.rise.getPositions(authority);
  }

  async getPortfolio(authority?: string): Promise<PhoenixTraderSnapshot> {
    return this.rise.getTraderSnapshot(authority);
  }

  // ── Margin & Risk ──

  async getMarginStatus(authority?: string, subaccountIndex = 0): Promise<PhoenixMarginStatus> {
    const auth = authority || this.config.wallet || "unknown";
    return this.rise.getMarginStatus(auth, subaccountIndex);
  }

  async getLiquidationPrice(symbol: string, authority?: string, subaccountIndex = 0): Promise<number | null> {
    const auth = authority || this.config.wallet || "";
    if (!auth) return null;
    return this.rise.getLiquidationPrice(auth, symbol, subaccountIndex);
  }

  // ── Rise SDK Order Execution ──

  async executeMarketOrder(req: RiseMarketOrderRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue; executor will fail if not connected
    }
    return this.executor.buildMarketOrder(req);
  }

  async executeLimitOrder(req: RiseLimitOrderRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue
    }
    return this.executor.buildLimitOrder(req);
  }

  async executeStopLoss(req: RiseStopLossRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue
    }
    return this.executor.buildStopLoss(req);
  }

  async executeCancel(req: RiseCancelRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue
    }
    return this.executor.buildCancel(req);
  }

  async executeDeposit(req: RiseCollateralRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue
    }
    return this.executor.buildDepositCollateral(req);
  }

  async executeWithdraw(req: RiseCollateralRequest): Promise<RiseExecutionPlan> {
    try {
      await this.executor.connect();
    } catch {
      // Continue
    }
    return this.executor.buildWithdrawCollateral(req);
  }

  // ── Health & Status ──

  async getRuntimeHealth() {
    const [healthResult, marketsResult, vulcanResult] = await Promise.allSettled([
      this.rise.health(),
      this.rise.listMarkets(),
      summarizeVulcanCatalog(this.repoRoot),
    ]);
    const healthError = healthResult.status === "rejected" ? errorMessage(healthResult.reason) : undefined;
    const marketsError = marketsResult.status === "rejected" ? errorMessage(marketsResult.reason) : undefined;
    const vulcanError = vulcanResult.status === "rejected" ? errorMessage(vulcanResult.reason) : undefined;

    return {
      health:
        healthResult.status === "fulfilled"
          ? healthResult.value
          : { ok: false, error: healthError },
      mode: resolveTradingMode(this.config),
      walletConfigured: Boolean(this.config.wallet),
      trackedMarkets: marketsResult.status === "fulfilled" ? marketsResult.value.length : 0,
      allowedSymbols: this.config.risk.allowedSymbols,
      readPlane: {
        ok: healthResult.status === "fulfilled" && marketsResult.status === "fulfilled",
        ...(healthError ? { healthError } : {}),
        ...(marketsError ? { marketsError } : {}),
      },
      vulcan:
        vulcanResult.status === "fulfilled"
          ? vulcanResult.value
          : { ok: false, error: vulcanError },
    };
  }

  async getVulcanCatalogSummary() {
    return summarizeVulcanCatalog(this.repoRoot);
  }

  // ── Preview Methods (legacy) ──

  previewObserve(symbol: string, expectedSpreadBps?: number): TraderActionPreview {
    const preflight = buildPreflightReport(this.config, {
      symbol,
      notionalUsd: 1,
      expectedSpreadBps,
      execution: "observe",
    });
    return {
      symbol: symbol.toUpperCase(),
      side: "buy",
      notionalUsd: 1,
      execution: "observe",
      preflight,
      route: {
        adapter: "rise",
        action: "market.ticker",
        payload: { symbol: symbol.toUpperCase() },
      },
    };
  }

  previewPaperTrade(
    symbol: string,
    side: "buy" | "sell",
    notionalUsd: number,
    expectedSpreadBps?: number,
  ): TraderActionPreview {
    const preflight = buildPreflightReport(this.config, {
      symbol,
      notionalUsd,
      expectedSpreadBps,
      execution: "paper",
    });
    return {
      symbol: symbol.toUpperCase(),
      side,
      notionalUsd,
      execution: "paper",
      preflight,
      route: {
        adapter: "vulcan",
        action: side === "buy" ? "paper-buy" : "paper-sell",
        payload: buildVulcanExecutionPlan(
          this.repoRoot,
          {
            action: side === "buy" ? "paper-buy" : "paper-sell",
            symbol,
            notionalUsd,
          },
          preflight,
        ),
      },
    };
  }

  previewLiveTrade(
    symbol: string,
    side: "buy" | "sell",
    notionalUsd: number,
    leverage?: number,
    expectedSpreadBps?: number,
  ): TraderActionPreview {
    const preflight = buildPreflightReport(this.config, {
      symbol,
      notionalUsd,
      leverage,
      expectedSpreadBps,
      execution: "rise-live",
    });

    return {
      symbol: symbol.toUpperCase(),
      side,
      notionalUsd,
      execution: "rise-live",
      preflight,
      route: {
        adapter: "rise",
        action: "order.place",
        payload: {
          symbol: symbol.toUpperCase(),
          side,
          notionalUsd,
          leverage,
          expectedSpreadBps,
          blocked: !preflight.ok,
        },
      },
    };
  }

  buildVulcanPlan(
    intent: VulcanExecutionIntent,
    notionalUsd = 1,
    expectedSpreadBps?: number,
  ): VulcanExecutionPlan {
    const preflight = buildPreflightReport(this.config, {
      symbol: intent.symbol ?? "SOL",
      notionalUsd,
      expectedSpreadBps,
      execution: intent.action.startsWith("live") ? "vulcan-live" : "paper",
    });
    return buildVulcanExecutionPlan(this.repoRoot, intent, preflight);
  }
}

export function createMarketMakerStatus(
  config: PerpsRuntimeConfig,
  intent: MarketMakerIntent,
): MarketMakerStatus {
  return new ClawdPerpsRuntime(config).createStatus(intent);
}