<p align="center">
  <img src="https://img.shields.io/badge/CLAWD-GROK-orange?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSIuOWVtIiBmb250LXNpemU9IjkwIj7wn5C0PC90ZXh0Pjwvc3ZnPg==" alt="Clawd Grok" />
  <br/>
  <img src="https://img.shields.io/npm/v/clawd-grok?color=orange&label=npm" alt="npm version" />
  <img src="https://img.shields.io/badge/bun-%3E%3D1.0-000?logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/Solana-mainnet-9945FF?logo=solana" alt="Solana" />
  <img src="https://img.shields.io/badge/powered_by-xAI_Grok-FF6600?logo=x&logoColor=white" alt="xAI Grok" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
</p>

# 🦞 Clawd Grok — The World's First Grok-Powered Solana Perps CLI

> **"Grok the markets. Claw the profits."**

**Clawd Grok** is the first AI trading agent that combines **xAI Grok's reasoning** with **Solana perpetual futures** on **Phoenix DEX**. Keyboard-driven, terminal-native, and ruthlessly effective — this is what happens when a lobster gets Grok'd.

---

<p align="center">
  <i>"The hardest choices require the strongest claws."</i> — 🦞
</p>

---

## 🚀 Why Clawd Grok?

| Feature | Clawd Grok | Other CLI tools |
|---------|------------|----------------|
| **AI Brain** | xAI Grok (4.3, 4.20, 3-mini) | GPT wrappers or no AI |
| **Chain** | Solana — fast, cheap, based | Multi-chain bloat |
| **DEX** | Phoenix DEX perpetuals + Vulcan | Spot-only or CEX APIs |
| **UI** | OpenTUI terminal (React, Ink) | Basic text output |
| **Strategies** | TWAP, Grid, TA-driven runners | Manual order entry |
| **Telegram** | Full remote control from phone | Desktop only |
| **MCP** | Local MCP server for agent clients | No agent interop |
| **Sub-Agents** | Parallel research, backtesting, analysis | Single-threaded |
| **Paper Trading** | Simulate with live prices, zero risk | Stubbed or missing |

---

## 📦 Install

```bash
curl -fsSL https://open-clawd.local/raw/install.sh | bash
```

**Prerequisites:** Bun 1.0+, a Solana wallet, and an RPC endpoint. For the AI agent, an **xAI Grok API key** (`GROK_API_KEY`).

---

## ⚡ Quick Start

```bash
# Interactive mode — fire up the full OpenTUI trading terminal
clawd

# Headless — Grok answers and executes in a single shot
clawd --prompt "show me SOL perps orderbook depth"

# Let Grok analyze and place a trade (paper-first!)
clawd -p "analyze SOL-PERP RSI and MACD on 4h, recommend entry"

# Pick a project directory
clawd -d /path/to/your/trading/workspace

# Continue where you left off
clawd --session latest

# JSON output for scripts, bots, and other agents
clawd --prompt "get portfolio snapshot" --format json
```

---

## 🧠 Powered by xAI Grok

Clawd Grok uses **xAI's Grok models** for reasoning, analysis, and trade decisions:

| Model | Best For |
|-------|----------|
| `grok-4.3` | Flagship reasoning — complex TA, multi-step strategies |
| `grok-4.20-non-reasoning` | Fast execution, market scanning |
| `grok-4.20-multi-agent` | Parallel sub-agent research, 2M context |
| `grok-3-mini` | Quick TA checks, signal evaluation |

Configure via `GROK_API_KEY`, `GROK_BASE_URL`, and `GROK_MODEL` in your `.env` or `~/.clawd/user-settings.json`.

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROK_API_KEY` | Yes | xAI Grok API key (`xai-...`) |
| `GROK_BASE_URL` | No | Custom endpoint (default: `https://api.x.ai/v1`) |
| `GROK_MODEL` | No | Model override (default: `grok-4.3`) |
| `GROK_MAX_TOKENS` | No | Max tokens per response (default: 16384) |
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint (mainnet-beta) |
| `PHOENIX_API_URL` | No | Phoenix perps API (default: `https://perp-api.phoenix.trade`) |
| `SOLANA_PRIVATE_KEY` | No | Base58-encoded Solana private key |

### Config File

Clawd Grok reads `~/.clawd/config.toml`:

```toml
[grok]
api_key = "xai-your-key-here"
model = "grok-4.3"
max_tokens = 16384

[network]
rpc_url = "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
api_url = "https://perp-api.phoenix.trade"

[wallet]
default = "my-wallet"

[trading]
default_slippage_bps = 50
confirm_trades = true
```

---

## 📊 What Clawd Grok Ships With

| Feature | Description |
|---------|-------------|
| 🤖 **Grok Agent** | xAI Grok reasons about markets, executes trades, runs strategies |
| 📈 **Phoenix Perps** | Market, limit, scale orders with TP/SL on Phoenix DEX |
| 🔬 **Technical Analysis** | RSI, MACD, Bollinger Bands, ATR, VWAP, ADX, Stoch, SMA, EMA |
| ⚙️ **Strategy Runners** | TWAP, Grid, TA-driven — with pause/resume/finalize lifecycle |
| 💼 **Portfolio** | Cross + isolated margin, positions with uPnL, collateral management |
| 🎮 **Paper Trading** | Simulate against live prices — zero risk, perfect for testing |
| 🔑 **Solana Wallet** | Generate, import, encrypt Solana keypairs locally |
| 🔌 **MCP Server** | Expose all tools as a local Model Context Protocol server |
| 🧩 **Agent Skills** | Bundled skill files for Claude Code, Cursor, Codex, and more |
| 📱 **Telegram Remote** | Control Clawd from your phone — pair once, trade anywhere |
| 🧵 **Sub-Agents** | Parallel Grok reasoning for research, analysis, backtesting |
| 💾 **Sessions** | Conversations persist; `--session latest` picks up where you left off |
| 🤖 **Headless Mode** | `--prompt` / `-p` for scripts, CI, automation, cron jobs |
| 🔧 **Hackable** | TypeScript, clear agent loop, bash-first tools — fork it, extend it |

---

## 💻 Command Reference

### Wallet Management

```bash
clawd wallet create --name my-wallet
clawd wallet import --name my-wallet --format base58 <key>
clawd wallet list
clawd wallet balance
```

### Market Data

```bash
clawd market list
clawd market ticker SOL -o json
clawd market orderbook SOL --depth 10
clawd market candles SOL --interval 1h --limit 50
clawd market trades SOL --limit 20
clawd market funding-rates SOL
```

### Trading

```bash
clawd trade market-buy SOL --notional-usdc 100 --tp 250 --sl 180
clawd trade market-sell SOL --tokens 1.5 --reduce-only
clawd trade limit-buy SOL 1.5 180 --tp 200
clawd trade limit-sell SOL 1.5 230 --reduce-only
clawd trade cancel SOL <order-id>
clawd trade cancel-all
```

### Positions

```bash
clawd position list -o json
clawd position show SOL
clawd position close SOL
clawd position close-all
```

### Margin & Collateral

```bash
clawd margin status -o json
clawd margin deposit 500
clawd margin withdraw 200
clawd margin leverage-tiers SOL
```

### Portfolio

```bash
clawd portfolio --include margin,positions,orders -o json
```

### Paper Trading

```bash
clawd paper init --balance 10000
clawd paper buy SOL --notional-usdc 100 --type market
clawd paper sell SOL --tokens 0.5 --type limit --price 200
clawd paper status -o json
```

### Technical Analysis

```bash
clawd ta compute SOL --indicator rsi --timeframe 1h
clawd ta compute SOL --indicator macd --params '{"fast":12,"slow":26,"signal":9}'
clawd ta report SOL --timeframe 4h -o json
clawd ta signal SOL --spec '{"indicator":"rsi","timeframe":"1h","op":"lt","threshold":30}'
```

### Strategy Runners

```bash
# TWAP — time-weighted average price
clawd strategy twap start \
  --symbol SOL --side buy --notional-usdc 5000 \
  --slices 10 --interval-seconds 300 \
  --mode paper --detached

# Grid — layered limit orders across a price band
clawd strategy grid start \
  --symbol SOL --center-on-mark --width-pct 2.5 \
  --levels-per-side 5 --tokens-per-level 0.5 \
  --run-until-stopped --mode paper --detached

# Lifecycle management
clawd strategy runs
clawd strategy status <run-id>
clawd strategy pause <run-id>
clawd strategy resume <run-id>
clawd strategy finalize <run-id> --cancel-orders --close-position --wait
```

---

## ⚠️ Execution Modes

Every trade and strategy supports these modes:

| Mode | Behavior |
|------|----------|
| `paper` | Simulated against live prices — no wallet, no chain (default) |
| `dry-run` | Builds and logs each step without submitting |
| `confirm-each` | Live orders — prompts for confirmation before each step |
| `auto-execute` | Live orders without prompts — use with guardrails |

**Always start in paper mode.** Never go live without testing first.

---

## 🛡️ Guardrails

| Flag | Protection |
|------|------------|
| `--max-total-notional-usdc <amount>` | Cap on total live notional |
| `--max-step-notional-usdc <amount>` | Cap on single-step notional |
| `--max-price-drift-bps <bps>` | Pause if mark price drifts too far |
| `--max-exposure-ratio <ratio>` | Pause if position/exposure exceeds ratio |

---

## 📱 Telegram Remote

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token
2. Set `TELEGRAM_BOT_TOKEN` in your env or `~/.clawd/user-settings.json`
3. Start `clawd`, open `/remote-control` → Telegram
4. In Telegram, DM your bot: `/pair`, enter the code in terminal
5. Trade from anywhere while keeping the CLI process running

---

## 🧩 Agent Skills & MCP

```bash
# Install skills for agent clients
clawd agent install --target claude
clawd agent install --target cursor
clawd agent install --target codex

# Start local MCP server for agent interop
clawd mcp --allow-dangerous --groups market,trade,position,margin
```

---

## 🔗 Solana RPC Setup

```bash
# Public endpoint (rate-limited)
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Helius (recommended for trading)
export SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# QuickNode / Triton / private RPC
export SOLANA_RPC_URL=https://your-provider.com/...
```

---

## 🛠️ Development

```bash
git clone https://open-clawd.local/clawd-grok.git
cd clawd-grok
bun install
bun run build
bun run start

# Dev workflow
bun run dev          # run from source
bun run typecheck    # type checking
bun run lint         # linting
bun run test         # run tests
```

### Project Structure

```
src/
├── index.ts              # CLI entry point (Commander.js + OpenTUI)
├── agent/
│   └── agent.ts          # Grok AI agent orchestrator
├── grok/
│   ├── client.ts         # xAI Grok API client (Chat Completions + Responses)
│   ├── models.ts         # Grok model definitions (grok-4.3, 4.20, etc.)
│   └── tools.ts          # Tool schemas (bash, search_web, search_x)
├── tools/
│   ├── bash.ts           # Shell command execution
│   ├── file.ts           # File operations
│   └── grep.ts           # Content search
├── ui/
│   └── app.tsx           # OpenTUI React terminal UI
├── storage/
│   └── db.ts             # SQLite session + transcript storage
├── utils/
│   ├── settings.ts       # User and project settings
│   └── instructions.ts   # AGENTS.md custom instructions
├── wallet/
│   └── manager.ts        # Solana keypair management
├── payments/
│   └── service.ts        # x402 payment integration
└── types/
    └── index.ts          # Shared TypeScript types
```

---

## 🦞 The Clawd Grok Manifesto

```
We are Clawd. We are Grok.

We don't click buttons in a web UI like peasants.
We type commands in a terminal.
We ask Grok to analyze, reason, and execute.

We trade Solana perps because Solana is fast and cheap.
We use Phoenix DEX because the fills are good.
We use Vulcan because the execution is battle-tested.
We use Grok because it reasons better than the rest.

We paper trade first. Always.
We respect the guardrails.
We protect our keys.
We don't get rekt.

This is the way of the clawd.
🦞
```

---

## 📄 License

MIT

---

## ⚠️ Disclaimer

Clawd Grok executes irreversible financial transactions on Solana Mainnet. You are responsible for wallet security, agent permissions, and all trading outcomes. This software is provided "as is" without warranty of any kind. **Paper trade first. Always test. Never risk more than you can afford to lose.**

---

<p align="center">
  <b>🦞 Clawd Grok — Grok the markets. Claw the profits. 🦞</b>
  <br/>
  <sub>Built with 🦞, ☕, and xAI Grok</sub>
</p>