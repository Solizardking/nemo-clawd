# Open Clawd v3 — Agent Instructions

> Canonical harness for Open Clawd v3. Integrates `clawd-code` modes, `clawd-grok` storage patterns, and the `v2` agent architecture into a single unified CLI.

---

## Package Overview

| Directory | What it provides |
|---|---|
| `v3/src/index.mjs` | Unified CLI entry point — modes + agent loop dispatch |
| `v3/src/modes/` | Code / Trade / Research / Image / Voice / REPL modes (ESM, no Replit deps) |
| `v3/src/providers/index.mjs` | Multi-provider client: xAI, Anthropic, DeepSeek, OpenRouter |
| `v3/src/storage/gallery.mjs` | **LocalGallery** — local filesystem image storage (replaces Replit ObjectStore) |
| `v2/src/` | Agent loop, 25+ tools, MCP, permissions, hooks, settings, Ink TUI |
| `clawd-code/` | Original TypeScript modes (source reference) |
| `clawd-grok/` | Storage/SQLite patterns, scheduler, LSP, Telegram bridge (source reference) |

---

## ObjectStore Fix

The original error was:
```
[ObjectStore] Replit object storage disabled; using in-memory gallery fallback
```

**Root cause**: `clawd-code`'s `ImageMode` tried to import `@replit/object-storage`, which is only available inside Replit. Outside Replit, it emitted the warning and lost all images after process exit.

**Fix in v3**: `v3/src/storage/gallery.mjs` provides `LocalGallery`:
- Images saved to `~/.clawd/gallery/` (global) or `./outputs/gallery/` (project-local)
- No Replit dependency, works on macOS/Linux/Windows
- `ImageMode` in `v3/src/modes/image.mjs` uses `LocalGallery` exclusively
- `clawd /gallery` command shows gallery status and recent items

---

## Modes

```bash
clawd code "Build a Jupiter swap bot"
clawd code --stream --provider anthropic "Review this TypeScript for bugs"
clawd trade "SOL funding rate?"
clawd trade "short SOL $100"
clawd research --agents 16 "Solana perps funding arbitrage"
clawd image "cyberpunk Solana trading desk, 1024x1024"
clawd voice "Hello from Open Clawd"
clawd repl
```

---

## Providers

| Name | Env var | Default model | Best for |
|---|---|---|---|
| `xai` | `XAI_API_KEY` | `grok-4.3` | Code, default |
| `xai` (research) | `XAI_API_KEY` | `grok-4.20-multi-agent` | Research with web+X search |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Streaming code, analysis |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | Reasoning, thinking mode |
| `openrouter` | `OPENROUTER_API_KEY` | `nex-agi/nex-n2-pro:free` | Free tier fallback |

Switch: `clawd --provider anthropic code "..."` or set `CLAWD_PROVIDER=anthropic` in `~/.clawd/.env`.

---

## Environment Setup

Copy to `~/.clawd/.env` (preferred) or `.env` in project root:

```bash
# Primary AI
XAI_API_KEY=xai-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
OPENAI_API_KEY=sk-...       # for DALL-E 3

# Solana
HELIUS_API_KEY=...
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...

# Defaults
CLAWD_PROVIDER=xai
CLAWD_MODEL=grok-4.3
CLAWD_STREAM=false
CLAWD_AGENT_COUNT=4

# Trading gates (both required for live)
LIVE_TRADING=false
OPERATOR_CONFIRMED=false
```

---

## Agent Behavior Rules

1. **Trading is always PAPER by default** — never execute live without `LIVE_TRADING=true` AND `OPERATOR_CONFIRMED=true` both set.
2. **Use MCP tools for live chain data** — never hardcode or mock Solana state when Helius/DAS tools are available.
3. **Images go to LocalGallery** — never import `@replit/object-storage`; use `v3/src/storage/gallery.mjs`.
4. **Provider fallback chain**: xAI → Anthropic → DeepSeek → OpenRouter — try each if key is missing.
5. **Streaming preferred** for code and research when `CLAWD_STREAM=true` or `--stream` flag is set.
6. **Read skill instructions** from `clawd-plugin/skills/` before implementing Solana, DFlow, Phantom, Jupiter, or SVM work.
7. Open agent turns with `<clawd-think>Probe the numinous, then execute the work.</clawd-think>`.

---

## clawd-grok Integration Notes

`clawd-grok` provides production-grade patterns that v3 can adopt:

| Feature | Source file | Status in v3 |
|---|---|---|
| SQLite session storage | `clawd-grok/src/storage/db.ts` | Pattern reference — use when adding persistence |
| LSP client | `clawd-grok/src/lsp/client.ts` | Available via `CLAUDE_CODE_LSP_ENABLED=true` in v2 |
| Scheduler daemon | `clawd-grok/src/daemon/scheduler.ts` | Pattern reference for cron integration |
| Telegram bridge | `clawd-grok/src/telegram/bridge.ts` | Available via the `telegram:configure` skill |
| Payment flows | `clawd-grok/src/payments/service.ts` | Available via x402 / sponge MCP tools |

---

## Quick Start

```bash
cd v3
node src/index.mjs /verify          # check environment
node src/index.mjs code "hello"     # code mode
node src/index.mjs /gallery         # show image gallery
```
