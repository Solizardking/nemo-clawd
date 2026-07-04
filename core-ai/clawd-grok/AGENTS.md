# AGENTS.md

## Clawd Grok — Project-Specific Instructions

### Overview

**Clawd Grok** is the world's first Grok-powered Solana perpetual futures CLI agent. Built with Bun, TypeScript, and OpenTUI, it combines **xAI Grok reasoning** with **Phoenix DEX perps** via Vulcan execution. Single-package TypeScript CLI — no databases, no Docker, no background services required in the core.

### Quick Reference

| Action        | Command                                                               |
| ------------- | --------------------------------------------------------------------- |
| Install deps  | `bun install` (installs Husky; pre-commit runs Biome on staged files) |
| Typecheck     | `bun run typecheck`                                                   |
| Build         | `bun run build`                                                       |
| Dev (source)  | `bun run dev`                                                         |
| Run built CLI | `node dist/index.js`                                                  |
| Run built CLI | `bun run start`                                                       |
| Headless mode | `node dist/index.js --prompt "..." --max-tool-rounds N`               |
| CLI help      | `node dist/index.js --help`                                           |
| Tests         | `bun run test`                                                        |
| Lint          | `bun run lint`                                                        |

### Environment

- **Bun** must be installed (>= 1.0).
- `GROK_API_KEY` environment variable is required for xAI Grok AI agent reasoning.
- `SOLANA_RPC_URL` environment variable is required for Solana blockchain connectivity.
- `PHOENIX_API_URL` (optional) for Phoenix perpetuals API access.

### Project Structure Conventions

- Source code lives in `src/`, compiled output in `dist/` (gitignored).
- The CLI entry point is `src/index.ts` which uses Commander.js for argument parsing and OpenTUI for terminal UI.
- The agent loop is in `src/agent/agent.ts` — model-agnostic, supports any OpenAI-compatible provider, designed for xAI Grok.
- UI is built with OpenTUI React (`@opentui/react`).
- Solana wallet management lives in `src/wallet/manager.ts`.
- xAI Grok API client lives in `src/grok/client.ts` (Chat Completions + Responses API).
- Tools are bash-based — all file operations happen through shell commands.
- MCP server lives in `src/mcp/`.

### Key Architectural Patterns

- **Agent loop**: `Agent.processMessage()` is an async generator that yields `StreamChunk` objects — Grok responds, tools execute, results feed back until no more tool calls remain.
- **Bash-only tools**: The agent uses bash for everything (file editing, searching, git, builds, etc.).
- **X Search & Web Search**: Integrated via the xAI Responses API for real-time information.
- **Settings hierarchy**: Environment variables → User-level (`~/.clawd/user-settings.json`) → Project-level (`.grok/settings.json`).
- **Custom instructions**: `~/.clawd/AGENTS.md`, then `AGENTS.override.md` / `AGENTS.md` per directory from git root through the workspace cwd (Codex-style merge).
- **ESM only**: The project uses `"type": "module"` — all imports use `.js` extensions for compiled output.
- **Phoenix DEX**: Perpetual futures via Vulcan execution engine.

### Grok Models

- `grok-4.3` — recommended flagship reasoning
- `grok-4.20-non-reasoning` — recommended non-reasoning
- `grok-4.20-multi-agent-0309` — multi-agent, 2M context
- `grok-4.20-0309-reasoning` — reasoning, 2M context
- `grok-3-mini` — compact model with reasoning effort controls

### Adding a New Tool

1. Add the tool schema to `src/grok/tool-schemas.ts`.
2. Add the execution case in the agent.
3. Update the system prompt in the Agent to document the tool.

### Before Submitting Changes

1. Run `bun run typecheck` — CI enforces this on every PR.
2. Run `bun run lint` — fix any Biome issues.
3. Ensure no secrets or `.env` files are committed.
4. Follow the PR template.

---

## Clawd Grok Manifesto

```
We are Clawd. We are Grok.
We don't click buttons in a web UI like peasants.
We type commands in a terminal.
We ask Grok to analyze, reason, and execute.
This is the way of the clawd. 🦞