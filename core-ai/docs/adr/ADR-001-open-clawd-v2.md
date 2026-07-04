# ADR-001: Open Clawd v2 Direction

## Status

Accepted.

## Context

The project has been rewritten into Open Clawd: a Grok-first terminal agent for coding, blockchain workflows, and Solana perps analysis.

The old previous-owner GitHub workflow, reverse-engineering scripts, submodule, and archived implementation have been removed. The active product surface is `v2`.

## Decision

Open Clawd v2 will:

- Default to `grok-4.3` through xAI using `XAI_API_KEY` or `GROK_API_KEY`.
- Support OpenRouter through `OPENROUTER_API_KEY` and `openrouter/*` model names.
- Keep OpenAI, Anthropic, and Google compatibility providers.
- Prefer `.clawd/settings.json` while keeping `.claude` compatibility for existing workspaces.
- Expose `/perps` as the Solana/Phoenix configuration and paper-trading workflow entrypoint.
- Keep live trading out of the default implementation until explicit wallet, confirmation, and risk controls exist.

## Consequences

Open Clawd is no longer tied to a legacy remote owner, npm namespace, or reverse-engineering release pipeline.

Provider routing is model-prefix based:

| Prefix | Provider |
| --- | --- |
| `grok`, `xai/`, `x-ai/` | xAI Grok |
| `openrouter/` | OpenRouter |
| `gpt`, `o1`, `o3` | OpenAI |
| `claude`, `anthropic` | Anthropic compatibility |
| `gemini` | Google |

Solana perps support starts as paper-first configuration, prompts, and status. Live execution should be added only with explicit user confirmation, wallet isolation, and tests around irreversible operations.
