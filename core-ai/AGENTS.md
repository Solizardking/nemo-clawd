# Core AI — Clawd Agent Instructions

> This file is the Layer A harness for Clawd Code and other Clawd-compatible agents.
> Skills in `.agents/skills/` provide the domain expertise (Layer B).

## Repository Overview

This monorepo contains Helius developer tools wrapped for Clawd Code:

| Package | What it does |
|---|---|
| `helius-mcp/` | MCP server (`npx helius-mcp@latest`) — exposes 10 public tools total |
| `helius-skills/` | Canonical skill source — `SKILL.md` + reference files for each domain |
| `helius-plugin/` | Clawd Code plugin — bundles skills + auto-starts MCP server |
| `helius-cli/` | CLI for account setup, blockchain queries, and staking |
| `helius-cursor/` | Cursor-compatible skill/rule package |
| `clawd-code/` | Full Solana-native AI CLI — xAI/Anthropic/DeepSeek/OpenRouter, voice, web, arena |
| `clawd-grok/` | Bun-native REPL + audio + LSP + MCP + wallet runtime |
| `clawd-agents/` | Perps agents: Phoenix Rise, Vulcan, Imperial, TWAMM, on-chain MM, Telegram |
| `ai-training/` | LoRA fine-tuning platform, HF Jobs, W&B, wiki ingest, Solana benchmark |

## Clawd Code Setup

Use the plugin directly:

```bash
clawd --plugin-dir ./helius-plugin
```

Or configure Helius MCP in `.clawd/settings.json`:

```json
{
  "mcpServers": {
    "helius": {
      "command": "npx",
      "args": ["helius-mcp@latest"]
    }
  }
}
```

For ZK Compression docs and Light Protocol examples, add the docs MCP server and install the Light Protocol skill pack:

```json
{
  "mcpServers": {
    "zkcompression": {
      "type": "http",
      "url": "https://www.zkcompression.com/mcp"
    }
  }
}
```

```bash
npx skills add Lightprotocol/skills
```

## Skills

Skills are in `.agents/skills/`. Each provides expert routing, rules, and reference docs:

| Skill | Directory | When to use |
|---|---|---|
| **Helius** | `.agents/skills/helius/` | Building Solana apps with Helius infrastructure |
| **Helius DFlow** | `.agents/skills/helius-dflow/` | Trading apps combining DFlow with Helius |
| **Helius Jupiter** | `.agents/skills/helius-jupiter/` | DeFi apps combining Jupiter with Helius |
| **Helius Phantom** | `.agents/skills/helius-phantom/` | Frontend Solana apps with Phantom wallet + Helius |
| **Helius OKX** | `.agents/skills/helius-okx/` | Trading/intelligence apps with OKX and Helius |
| **SVM** | `.agents/skills/svm/` | Solana protocol internals |

For compressed PDAs, compressed tokens, nullifiers, validity proofs, or custom ZK apps, also load the Light Protocol skills installed via `npx skills add Lightprotocol/skills`.

Read the relevant `SKILL.md` before implementing. It tells you which reference files to read and which MCP tools to use.

## Clawd Code Modes

`clawd-code` supports multiple modes selectable via `--mode` or at the REPL:

| Mode | Command | Description |
|---|---|---|
| `code` | `clawd-code code "<prompt>"` | AI coding assistant (default) |
| `trade` | `clawd-code trade "<prompt>"` | Paper-gated Phoenix/Vulcan perps |
| `research` | `clawd-code research "<prompt>"` | Web search + synthesis |
| `image` | `clawd-code image "<prompt>"` | Image generation |
| `voice` | `clawd-code voice --persona eve` | Real-time voice — eve/ara/rex/sal |
| `web` | `clawd-code web` | Local Next.js UI on port 3000 |
| `arena` | `clawd-code arena "<prompt>"` | Multi-provider side-by-side benchmark |

## Multi-Provider LLM Routing

Set the appropriate API key env var and pass `--model`:

- `XAI_API_KEY` → `grok-4-20`, `grok-4.20-multi-agent`
- `ANTHROPIC_API_KEY` → `claude-opus-4-8`, `claude-sonnet-4-6`
- `DEEPSEEK_API_KEY` → `deepseek-r1`, `deepseek-v3`
- `OPENROUTER_API_KEY` → any OpenRouter model ID

## Coding Conventions

- TypeScript: `import { createHelius } from "helius-sdk"` then `const helius = createHelius({ apiKey })`
- Rust: `use helius::Helius` then `Helius::new("apiKey", Cluster::MainnetBeta)?`
- For `@solana/kit` integration, use `helius.raw` for the underlying `Rpc` client.
- For Clawd Code workflows, use `clawd-code <mode> "<prompt>"`.

## Environment Variables

- Never commit API keys to git.
- Use `HELIUS_API_KEY` for Helius tools.
- Use `~/.clawd-code/.env` with `XAI_API_KEY`, `HELIUS_API_KEY`, and `SOLANA_RPC_URL` for Clawd Code.
- Use `WANDB_API_KEY` for W&B training tracking (ai-training/ only).
- Use `HONCHO_API_KEY` for persistent cross-session agent memory (ai-training/memory/honcho.py).

## MCP Tool Usage Rules

- Use MCP tools for live blockchain data; do not hardcode or mock chain state.
- Prefer specific routed actions, such as `heliusWallet` + `getBalance`, over broad expensive calls.
- Use batch endpoints when available.
- Use `heliusTransaction` + `parseTransactions` for human-readable transaction data.
- Use `heliusKnowledge` + `troubleshootError` before manual diagnosis.
- Use `heliusKnowledge` + `getRateLimitInfo` or `getHeliusCreditsInfo`; do not guess credit costs.
- For pricing questions, start with `heliusAccount` + `getHeliusPlanInfo`.

## Transaction Sending

- Use Helius Sender endpoints for low-latency sends.
- Include `skipPreflight: true` and `maxRetries: 0` when using Sender.
- Include a Jito tip and priority fee.
- Use `heliusChain` + `getPriorityFeeEstimate`; do not hardcode fees.

## AI Training Platform

When working in `ai-training/`:

- Launch training jobs with `bash scripts/launch_hf_jobs.sh a100-large`.
- Ingest wiki SFT data with `python3 scripts/ingest_wiki_data.py --push`.
- Run the Solana benchmark with `python3 scripts/solana_benchmark.py --model ordlibrary/DeepSolanaZKr-1`.
- Check W&B eval status with `python3 scripts/wandb_eval.py`.
- Use `memory/honcho.py` `AgentMemory` for persistent cross-session recall; set `HONCHO_API_KEY` for cloud storage.
- All HF Job storage must route to `/data` bucket — `HF_HOME=/data/hf_cache`, `output_dir: /data/outputs/`.
- Base model is `Qwen/Qwen2.5-1.5B-Instruct`; do not switch to multi-shard models without checking shard count first.

## Generated Content

The following directories are generated by `npx tsx scripts/compile-skills.ts` from canonical sources in `helius-skills/`:

- `.agents/skills/`
- `helius-mcp/system-prompts/`

Modify canonical source in `helius-skills/` and re-run the compiler.
