#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadClawdPerpsEnv } from "./env.js";
import { buildPerpsFrontendStatus } from "./frontend.js";
import { ClawdPerpsRuntime } from "./marketMaker.js";
import { handleTelegramPerpsCommand } from "./telegram.js";
import { ImperialClient } from "./imperialAgent.js";
import { resolveClawdRepoRoot } from "./paths.js";
import { redactSensitiveText, redactSensitiveValue } from "./redaction.js";

loadClawdPerpsEnv(import.meta.url);

// ── Character ─────────────────────────────────────────────────────────────────

interface ClawdCharacter {
  name: string;
  bio: string[];
  lore: string[];
  adjectives: string[];
  topics: string[];
  style: { all: string[]; chat: string[]; post: string[] };
  system?: string;
  messageExamples?: unknown[];
  postExamples?: string[];
}

function loadCharacter(): ClawdCharacter | null {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(dir, "../clawd.json"), "utf-8");
    return JSON.parse(raw) as ClawdCharacter;
  } catch {
    return null;
  }
}

function printCharacterBanner(char: ClawdCharacter): void {
  const hr = "─".repeat(60);
  console.error(`\n${hr}`);
  console.error(`  ${char.name}`);
  console.error(hr);
  for (const line of char.bio) {
    console.error(`  ${line}`);
  }
  if (char.system) {
    console.error(`\n  [system] ${char.system.slice(0, 120)}…`);
  }
  console.error(`${hr}\n`);
}
import {
  buildOnchainMarketMaker,
  buildOnchainMarketMakerPlan,
  getOnchainMarketMakerStatus,
  runOnchainMarketMaker,
} from "./onchainMarketMaker.js";
import {
  buildTwammAutomation,
  buildTwammBuildPlan,
  buildTwammCrankPlan,
  buildTwammTestPlan,
  getTwammAutomationStatus,
  runTwammCrank,
} from "./twammAutomation.js";

type ParsedArgs = {
  command: string;
  rest: string[];
  options: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "status", ...tail] = argv;
  const rest: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < tail.length; i++) {
    const item = tail[i];
    if (!item.startsWith("--")) {
      rest.push(item);
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split("=", 2);
    const next = tail[i + 1];
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      options[rawKey] = next;
      i++;
    } else {
      options[rawKey] = true;
    }
  }

  return { command, rest, options };
}

function repoRoot(): string {
  return resolveClawdRepoRoot(process.cwd(), import.meta.url);
}

function asNumber(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSymbols(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const symbols = value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  return symbols.length ? symbols : undefined;
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(redactSensitiveValue(data), null, 2));
}

function printHelp(): void {
  console.log(`clawd-agents-perps

Usage:
  clawd-agents-perps status
  clawd-agents-perps frontend
  clawd-agents-perps telegram "/perps"
  clawd-agents-perps vulcan
  clawd-agents-perps rise <subcommand> [options]   (see "rise help")
  clawd-agents-perps paper-long SOL --notional 100
  clawd-agents-perps paper-short SOL --notional 100
  clawd-agents-perps live-long SOL --notional 100 --leverage 2
  clawd-agents-perps live-short SOL --notional 100 --leverage 2
  clawd-agents-perps character
  clawd-agents-perps imperial-health
  clawd-agents-perps imperial-scan --symbols SOL,BTC,ETH --size 100
  clawd-agents-perps imperial-cycle SOL --size 100
  clawd-agents-perps onchain-mm status
  clawd-agents-perps onchain-mm build
  clawd-agents-perps onchain-mm plan --market <pubkey> --ticker SOL-USD
  clawd-agents-perps onchain-mm run --market <pubkey> --yes
  clawd-agents-perps twamm status
  clawd-agents-perps twamm build
  clawd-agents-perps twamm crank-plan --token-a <mint> --token-b <mint>
  clawd-agents-perps twamm crank --token-a <mint> --token-b <mint> --yes

Safety:
  Defaults are observe/paper. Live previews remain blocked unless the runtime
  is explicitly armed with LIVE_TRADING=true, OPERATOR_CONFIRMED=true, and
  PERPS_SIM_ONLY=false. Imperial order submission also requires IMPERIAL_LIVE=true.
`);
}

function printTwammHelp(): void {
  console.log(`clawd-agents-perps twamm

Usage:
  clawd-agents-perps twamm status
  clawd-agents-perps twamm build [--skip-app-install]
  clawd-agents-perps twamm build-plan [--skip-app-install]
  clawd-agents-perps twamm test-plan [--cargo]
  clawd-agents-perps twamm crank-plan [--rpc-url <url>] [--token-a <mint>] [--token-b <mint>] [--wallet <path>] [--once]
  clawd-agents-perps twamm crank --token-a <mint> --token-b <mint> --yes

Environment:
  CLAWD_TWAMM_ROOT          Path to Perps/twamm-master
  CLAWD_TWAMM_RPC_URL       RPC alias/url, default SOLANA_RPC_URL/local
  CLAWD_TWAMM_TOKEN_A_MINT  Default first token mint
  CLAWD_TWAMM_TOKEN_B_MINT  Default second token mint
  CLAWD_TWAMM_LIVE=true and OPERATOR_CONFIRMED=true required for crank
`);
}

function printRiseHelp(): void {
  console.log(`clawd-agents-perps rise

Rise SDK commands use @ellipsis-labs/rise to build unsigned Solana instructions.
Sign + submit via your wallet/signer service.

Market Data:
  clawd-agents-perps rise orderbook <symbol> [--depth 20]
  clawd-agents-perps rise candles <symbol> [--interval 1h] [--limit 20]
  clawd-agents-perps rise funding <symbol>
  clawd-agents-perps rise bbo <symbol>
  clawd-agents-perps rise stats <symbol>

Order Building (returns unsigned instructions):
  clawd-agents-perps rise market-buy <symbol> --notional 100 [--slippage-bps 50]
  clawd-agents-perps rise market-sell <symbol> --notional 100 [--slippage-bps 50]
  clawd-agents-perps rise limit-buy <symbol> --price 200 --tokens 0.5
  clawd-agents-perps rise limit-sell <symbol> --price 200 --tokens 0.5
  clawd-agents-perps rise stop-loss <symbol> --trigger-price 140 [--slippage-bps 100]
  clawd-agents-perps rise cancel <symbol> [--order-ids id1,id2]
  clawd-agents-perps rise cancel-all <symbol>
  clawd-agents-perps rise deposit --amount 500
  clawd-agents-perps rise withdraw --amount 500

Risk & Margin:
  clawd-agents-perps rise margin [--authority <pubkey>]
  clawd-agents-perps rise margin-status

Preflight gates: LIVE_TRADING=true, OPERATOR_CONFIRMED=true, PERPS_SIM_ONLY=false.
`);
}

function printOnchainMmHelp(): void {
  console.log(`clawd-agents-perps onchain-mm

Usage:
  clawd-agents-perps onchain-mm status
  clawd-agents-perps onchain-mm build [--release]
  clawd-agents-perps onchain-mm plan [--market <pubkey>] [--ticker SOL-USD] [--rpc-url local]
  clawd-agents-perps onchain-mm run --market <pubkey> --yes

Environment:
  CLAWD_ONCHAIN_MM_ROOT    Path to Perps/phoenix-onchain-market-maker-master
  CLAWD_ONCHAIN_MM_MARKET  Phoenix market pubkey
  CLAWD_ONCHAIN_MM_TICKER  Coinbase ticker, default SOL-USD
  CLAWD_ONCHAIN_MM_RPC_URL RPC alias/url, default local/SOLANA_RPC_URL
  CLAWD_ONCHAIN_MM_LIVE=true and OPERATOR_CONFIRMED=true required for run
`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  const character = loadCharacter();
  if (character && parsed.command !== "help" && parsed.command !== "--help" && parsed.command !== "-h") {
    printCharacterBanner(character);
  }

  if (parsed.command === "character") {
    printJson(character ?? { error: "clawd.json not found" });
    return;
  }

  const createRuntime = () => {
    const runtime = new ClawdPerpsRuntime(undefined, repoRoot());
    runtime.init().catch(() => {});
    return runtime;
  };

  if (parsed.command === "onchain-mm") {
    const subcommand = parsed.rest[0] || "status";
    const runOptions = {
      market: typeof parsed.options.market === "string" ? parsed.options.market : undefined,
      ticker: typeof parsed.options.ticker === "string" ? parsed.options.ticker : undefined,
      rpcUrl: typeof parsed.options["rpc-url"] === "string" ? parsed.options["rpc-url"] : undefined,
      keypairPath: typeof parsed.options["keypair-path"] === "string" ? parsed.options["keypair-path"] : undefined,
      quoteEdgeBps: asNumber(parsed.options["quote-edge-bps"], 3),
      quoteSize: asNumber(parsed.options["quote-size"], 100_000_000),
      refreshMs: asNumber(parsed.options["refresh-ms"], 2000),
      priceImprovement: typeof parsed.options["price-improvement"] === "string" ? parsed.options["price-improvement"] : undefined,
      postOnly: parsed.options["post-only"] !== false,
      release: Boolean(parsed.options.release),
      yes: Boolean(parsed.options.yes),
    };

    switch (subcommand) {
      case "help":
      case "--help":
      case "-h":
        printOnchainMmHelp();
        return;
      case "status":
        printJson(getOnchainMarketMakerStatus());
        return;
      case "build":
      case "install":
        printJson(buildOnchainMarketMaker({ release: Boolean(parsed.options.release) }));
        return;
      case "plan":
        printJson(buildOnchainMarketMakerPlan(runOptions));
        return;
      case "run":
        runOnchainMarketMaker(runOptions);
        return;
      default:
        console.error(`Unknown onchain-mm command: ${subcommand}`);
        printOnchainMmHelp();
        process.exitCode = 1;
        return;
    }
  }

  if (parsed.command === "twamm") {
    const subcommand = parsed.rest[0] || "status";
    const crankOptions = {
      rpcUrl: typeof parsed.options["rpc-url"] === "string" ? parsed.options["rpc-url"] : undefined,
      tokenAMint: typeof parsed.options["token-a"] === "string" ? parsed.options["token-a"] : undefined,
      tokenBMint: typeof parsed.options["token-b"] === "string" ? parsed.options["token-b"] : undefined,
      walletPath: typeof parsed.options.wallet === "string" ? parsed.options.wallet : undefined,
      once: Boolean(parsed.options.once),
      yes: Boolean(parsed.options.yes),
    };

    switch (subcommand) {
      case "help":
      case "--help":
      case "-h":
        printTwammHelp();
        return;
      case "status":
        printJson(getTwammAutomationStatus());
        return;
      case "build-plan":
        printJson(buildTwammBuildPlan({ skipAppInstall: Boolean(parsed.options["skip-app-install"]) }));
        return;
      case "build":
      case "install":
        printJson(buildTwammAutomation({ skipAppInstall: Boolean(parsed.options["skip-app-install"]) }));
        return;
      case "test-plan":
        printJson(buildTwammTestPlan({ anchor: !parsed.options.cargo, cargo: Boolean(parsed.options.cargo) }));
        return;
      case "crank-plan":
      case "plan":
        printJson(buildTwammCrankPlan(crankOptions));
        return;
      case "crank":
      case "run":
        runTwammCrank(crankOptions);
        return;
      default:
        console.error(`Unknown twamm command: ${subcommand}`);
        printTwammHelp();
        process.exitCode = 1;
        return;
    }
  }

  // ── Rise SDK command group ──
  if (parsed.command === "rise") {
    const subcommand = parsed.rest[0] || "help";
    const symbol = parsed.rest[1]?.toUpperCase() || "SOL";

    if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
      printRiseHelp();
      return;
    }

    const runtime = createRuntime();
    await runtime.init();

    switch (subcommand) {
      case "orderbook":
      case "book": {
        printJson(await runtime.getOrderbook(symbol, asNumber(parsed.options.depth, 20)));
        return;
      }
      case "candles": {
        printJson(await runtime.getCandles(symbol, String(parsed.options.interval || "1h"), asNumber(parsed.options.limit, 20)));
        return;
      }
      case "funding": {
        printJson(await runtime.getFundingRates(symbol));
        return;
      }
      case "bbo": {
        printJson(await runtime.getBbo(symbol));
        return;
      }
      case "stats":
      case "market-stats": {
        printJson(await runtime.getMarketStats(symbol));
        return;
      }
      case "market-buy":
      case "market-sell":
      case "market-order": {
        const side = subcommand === "market-sell" ? "sell" : "buy";
        printJson(await runtime.executeMarketOrder({
          symbol,
          side: side as "buy" | "sell",
          notionalUsd: asNumber(parsed.options.notional, 100),
          slippageBps: asNumber(parsed.options["slippage-bps"], 50),
        }));
        return;
      }
      case "limit-buy":
      case "limit-sell":
      case "limit-order": {
        const side = subcommand === "limit-sell" ? "sell" : "buy";
        printJson(await runtime.executeLimitOrder({
          symbol,
          side: side as "buy" | "sell",
          priceUsd: asNumber(parsed.options.price, 0),
          tokens: asNumber(parsed.options.tokens, 0),
        }));
        return;
      }
      case "stop-loss":
      case "sl": {
        printJson(await runtime.executeStopLoss({
          symbol,
          triggerPrice: asNumber(parsed.options["trigger-price"], asNumber(parsed.options.trigger, 0)),
          slippageBps: asNumber(parsed.options["slippage-bps"], 100),
        }));
        return;
      }
      case "cancel": {
        const orderIds = typeof parsed.options["order-ids"] === "string" ? parsed.options["order-ids"].split(",") : undefined;
        printJson(await runtime.executeCancel({ symbol, orderIds }));
        return;
      }
      case "cancel-all": {
        printJson(await runtime.executeCancel({ symbol }));
        return;
      }
      case "deposit": {
        printJson(await runtime.executeDeposit({ amountUsd: asNumber(parsed.options.amount, 100) }));
        return;
      }
      case "withdraw": {
        printJson(await runtime.executeWithdraw({ amountUsd: asNumber(parsed.options.amount, 100) }));
        return;
      }
      case "margin":
      case "margin-status": {
        printJson(await runtime.getMarginStatus(parsed.options.authority as string || undefined));
        return;
      }
      default:
        console.error(`Unknown rise subcommand: ${subcommand}`);
        printRiseHelp();
        process.exitCode = 1;
        return;
    }
  }

  switch (parsed.command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "status":
    case "health": {
      const runtime = createRuntime();
      printJson(await runtime.getRuntimeHealth());
      return;
    }
    case "frontend": {
      const runtime = createRuntime();
      printJson(await buildPerpsFrontendStatus(runtime));
      return;
    }
    case "telegram": {
      const runtime = createRuntime();
      printJson(await handleTelegramPerpsCommand(runtime, parsed.rest.join(" ") || "/perps"));
      return;
    }
    case "vulcan": {
      const runtime = createRuntime();
      printJson(await runtime.getVulcanCatalogSummary());
      return;
    }
    case "paper-long": {
      const runtime = createRuntime();
      printJson(runtime.previewPaperTrade(parsed.rest[0] || "SOL", "buy", asNumber(parsed.options.notional, 100)));
      return;
    }
    case "paper-short": {
      const runtime = createRuntime();
      printJson(runtime.previewPaperTrade(parsed.rest[0] || "SOL", "sell", asNumber(parsed.options.notional, 100)));
      return;
    }
    case "live-long": {
      const runtime = createRuntime();
      printJson(
        runtime.previewLiveTrade(
          parsed.rest[0] || "SOL",
          "buy",
          asNumber(parsed.options.notional, 100),
          asNumber(parsed.options.leverage, 1),
        ),
      );
      return;
    }
    case "live-short": {
      const runtime = createRuntime();
      printJson(
        runtime.previewLiveTrade(
          parsed.rest[0] || "SOL",
          "sell",
          asNumber(parsed.options.notional, 100),
          asNumber(parsed.options.leverage, 1),
        ),
      );
      return;
    }
    case "imperial-health": {
      const client = new ImperialClient();
      printJson(await client.healthCheck());
      return;
    }
    case "imperial-scan": {
      const symbols = parseSymbols(parsed.options.symbols);
      const client = new ImperialClient(symbols ? { allowedSymbols: symbols } : undefined);
      printJson(
        await client.runScan({
          sizeUsd: asNumber(parsed.options.size, 100),
          autoRoute: Boolean(parsed.options["auto-route"]),
        }),
      );
      return;
    }
    case "imperial-cycle": {
      const client = new ImperialClient();
      printJson(
        await client.runCycle(parsed.rest[0] || "SOL", {
          sizeUsd: asNumber(parsed.options.size, 100),
          autoRoute: Boolean(parsed.options["auto-route"]),
        }),
      );
      return;
    }
    default:
      console.error(`Unknown command: ${parsed.command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});