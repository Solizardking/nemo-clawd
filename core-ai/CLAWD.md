# Core AI — Clawd Instructions

This is the canonical Clawd harness for the Clawd-wrapped Helius Core AI fork.

Use this repository as Clawd-native tooling:

- Run the plugin with `clawd --plugin-dir ./helius-plugin`.
- Configure MCP servers in `.clawd/settings.json`.
- Enable ZK Compression docs with the `zkcompression` MCP server at `https://www.zkcompression.com/mcp`.
- Install Light Protocol skills with `npx skills add Lightprotocol/skills` before compressed PDA, compressed token, or custom ZK application work.
- Use `clawd-code` for code, trade, research, image, and voice workflows. The full TypeScript source for the CLI lives in [`./clawd-code/`](./clawd-code/) and installs with `cd clawd-code && npm install && npm run build && ./install.sh`.
- For Bun-native Clawd / Grok agent work (REPL, audio, LSP, MCP, wallet), use [`./clawd-grok/`](./clawd-grok/) with `bun install && bun run dev`.
- For perps-specialized agents (Phoenix Rise, Vulcan, Imperial, TWAMM, on-chain MM), use [`./clawd-perps-agent/`](./clawd-perps-agent/) with `npm install && npm run build`.
- The standalone [`./mcp-server/`](./mcp-server/) hosts the pump-sdk and related MCP tools. The [`./v3/`](./v3/) subfolder holds the next-generation Clawd runtime scaffold.
- [`./knowledge/`](./knowledge/) is the Clawd knowledge base (facts, gotchas, patterns, decisions). [`./docs/adr/`](./docs/adr/) holds the architecture decision records.
- Read canonical skill sources from `helius-skills/` before editing generated `.agents/skills/` or `helius-mcp/system-prompts/` outputs.
- Keep generated prompt variants Clawd-native: `clawd.developer.md`, `clawd.system.md`, and `full.md`.
- Keep all trading/execution work gated by Clawd Code preflight and PAPER defaults unless explicitly armed.

## Clawd Code — Extended Capabilities (clawd-code/)

The `clawd-code/` CLI is the full-featured Solana-native AI coding CLI. Key capabilities beyond basic code mode:

### Multi-Provider LLM Routing

- **xAI / Grok**: `XAI_API_KEY` → `grok-4-20` (default), `grok-4.20-multi-agent` for multi-agent runs
- **Anthropic**: `ANTHROPIC_API_KEY` → Claude Opus / Sonnet / Haiku
- **DeepSeek**: `DEEPSEEK_API_KEY` → DeepSeek-R1, DeepSeek-V3
- **OpenRouter**: `OPENROUTER_API_KEY` → any hosted model
- Model selection via `clawd-code --model <id>` or `clawd.json` `defaultModel`

### Voice Mode (voice/)

Four personas available via `clawd-code voice --persona <name>`:

- `eve` — analytical, precise, technical
- `ara` — warm, creative, exploratory
- `rex` — direct, aggressive, trading-focused
- `sal` — calm, strategic, long-horizon

### Web Interface (web/)

- `clawd-code web` starts a local Next.js interface on port 3000
- Full REPL, file browser, and agent chat in the browser
- Arena mode: side-by-side model comparison at `/arena`

### Arena Mode (arena.ts)

`clawd-code arena "<prompt>"` runs the same prompt across multiple configured providers. Results displayed side-by-side; useful for benchmarking Grok vs Claude vs DeepSeek.

### Modes (modes/)

- `code` — default AI coding assistant
- `trade` — paper-gated Phoenix/Vulcan perps workflows
- `research` — web search + synthesis
- `image` — image generation
- `voice` — real-time voice with TTS/STT

### Tools (src/tools/)

Full tool suite available to agents: bash, file read/write/edit, glob, grep, web fetch/search, MCP client, notebook edit, task management, and more.

### MCP Client

Built-in MCP client (`context.ts`, `QueryEngine.ts`) connects to any MCP server in `.clawd/settings.json`. Helius MCP, Vulcan MCP, and ZK Compression MCP all supported out of the box.

### Identity / Soul (IDENTITY.md, SOUL.md)

Core identity: lobster-native, Solana-first, paper-gated trading. `SOUL.md` defines the agent's character; `agent.md` the behavior contract.

## AI Training Platform (ai-training/)

The `ai-training/` directory is the Clawd fine-tuning platform:

- **Dataset**: `solanaclawd/solana-clawd-instruct` — 30,450+ Solana/DeFi instruction-following pairs
- **Model**: `ordlibrary/DeepSolanaZKr-1` / `solanaclawd/solana-clawd-1.5b-lora` — LoRA on `Qwen/Qwen2.5-1.5B-Instruct`
- **Training**: HuggingFace Jobs (A100-large), TRL SFT, W&B tracking
- **Wiki integration**: 18 SFT pairs from `clawd-autoresearch-wiki` (6 Solana domains) via `scripts/ingest_wiki_data.py`
- **Benchmark**: 18-MCQ Solana knowledge test via `scripts/solana_benchmark.py`
- **Memory**: Honcho-backed persistent cross-session agent memory via `memory/honcho.py`
- **W&B eval**: Post-training Weave evaluation via `scripts/wandb_eval.py`

## $CLAWD Token

Mint: `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`

All Clawd AI products, models, and datasets are associated with the $CLAWD token on Solana. Token gates apply to the `clawd-pump` tier in ClawdRouter free inference.
