# Deploy Nemo Clawd on Fly.io

To deploy Nemo Clawd to Fly.io, run the deploy script from the repo root. It handles everything — app creation, volumes, secrets, and deployment.

```bash
cd /path/to/nemoclawd
bash deploy/fly/deploy.sh
```

You'll need `flyctl` installed, a Fly.io account (free trial works), and an LLM API key (Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax).

---

## What is Nemo Clawd?

Nemo Clawd is a one-shot Solana developer agent with Pump-Fun tooling, Privy agentic wallets, and a Telegram-native operator stack. It runs on top of Nemo Clawd as a persistent AI gateway reachable from Discord, Telegram, Slack, or your local CLI.

---

## How it works

The deploy script sets up a wrapper server that manages the Nemo Clawd gateway and provides a browser-based setup wizard:

```
Internet → Fly.io proxy → Wrapper server (:3000) → Nemo Clawd gateway (:18789)
                              ├── /setup      → Setup wizard (password-protected)
                              ├── /healthz    → Health check (no auth)
                              └── /*          → Proxied to gateway
```

All state lives on a persistent volume mounted at `/data`, so your configuration, conversation history, wallets, and installed tools survive restarts and redeployments.

---

## What the script prompts for

| Prompt | Description |
|--------|-------------|
| **App name** | Defaults to `nemoclawd-XXXX` (random suffix). Becomes your URL: `https://your-app.fly.dev` |
| **Region** | Where to run your Machine (defaults to `iad` / Virginia). [See regions](https://fly.io/docs/reference/regions/) |
| **Setup password** | Protects the `/setup` wizard. Pick something strong. |
| **LLM provider** | Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax |
| **API key** | The key for your chosen provider |
| **Channel tokens** | (Optional) Discord, Telegram, or Slack tokens |
| **Solana config** | (Optional) RPC URL, Helius API key, Privy App ID/Secret |

Your credentials never leave your machine — they go directly to Fly.io as encrypted secrets via `flyctl`.

---

## Post-deploy setup

Once deployment completes, the script prints your app details:

```
=== Deployment Complete ===

  App URL:       https://your-app.fly.dev
  Setup wizard:  https://your-app.fly.dev/setup
  Gateway URL:   wss://your-app.fly.dev
  Gateway token: <your-generated-token>
```

### Setup wizard

Visit `https://your-app.fly.dev/setup` in your browser. Log in with any username and the setup password you chose. From the wizard you can:

- Change your LLM provider and API key
- Configure Solana RPC, Helius, and Privy wallet credentials
- Add or update Discord, Telegram, and Slack channel connections
- Edit the raw Nemo Clawd config
- View gateway logs
- Export and import configuration backups

### Connect your local CLI

```bash
 nemoclawd configset gateway.mode remote
 nemoclawd configset gateway.remote.url wss://your-app.fly.dev
 nemoclawd configset gateway.remote.token <your-gateway-token>
 nemoclawd health # verify the connection
```

---

## Repository Walkthrough

The Nemo Clawd repo is organized into these major areas:

```
nemoclawd/
│
├── .dockerignore .gitignore .env.local
├── CONTRIBUTING.md LICENSE SECURITY.md SKILL.md
├── Dockerfile                        # Local build image
├── Makefile                          # Build/install targets
├── package.json                      # Main CLI package (@mawdbotsonsolana/nemoclawd)
├── pyproject.toml                    # Python SDK/deps
├── tsconfig.json vitest.config.ts    # TypeScript + test config
├── install.sh uninstall.sh           # Curl-pipe-bash installer
│
├── src/                              # Core CLI
│   ├── index.ts                      # OpenShell plugin registration: slash commands,
│   │                                 #   model providers (ZAI GLM, NVIDIA NIM, DFlow),
│   │                                 #   CLI subcommands, background dflow-routing service
│   ├── cli.ts                        # CLI entry — commander.js, subcommands, arguments
│   ├── dflow.ts                      # DFlow spot + prediction market routing logic
│   ├── magic-router.ts               # Magic router dispatch
│   ├── blueprint/                    # Agent blueprints and configuration profiles
│   ├── commands/                     # CLI subcommands (status, migrate, launch, connect, logs, eject, onboard)
│   └── onboard/                      # Onboarding wizards and setup flows
│
├── bin/
│   ├── nemoclawd.js                  # Executable entry point
│   └── lib/                          # Runtime support modules
│
├── nemo-clawd-mcp/                   # MCP Server (32 tools, dual transport)
│   ├── package.json                  # @mawdbotsonsolana/nemoclawd-mcp
│   ├── fly.toml                      # Standalone MCP Fly.io deploy
│   ├── tsconfig.json
│   ├── README.md
│   └── src/
│       ├── index.ts                  # STDIO entry (desktop MCP clients)
│       ├── http.ts                   # HTTP/SSE entry (remote + Agent Toolkit)
│       └── server.ts                 # Core 32-tool MCP server factory
│                                     #   Solana: balance, token, price, swap, Jupiter
│                                     #   Pump.fun: launch, buy, sell, migrate, creator fees
│                                     #   Grok: chat, analyze, generate, random, mode
│                                     #   Registry: register, heartbeat, verify
│                                     #   Agent: spawn, list, manage fleet
│                                     #   System: health, version, capabilities
│
├── nemo-clawd-python/                # Python SDK
│   ├── pyproject.toml
│   ├── Makefile
│   ├── blueprint.yaml
│   ├── migrations/                   # Database/state migrations
│   ├── orchestrator/                 # Agent orchestration logic
│   └── policies/                     # Policy definitions
│
├── scripts/                          # Shell scripts for setup, agents, deployment
│   ├── install.sh                    # Curl-pipe-bash end-user installer
│   ├── setup.sh                      # Full host setup (Docker, OpenShell, deps)
│   ├── brev-setup.sh                 # Brev VM bootstrap
│   ├── setup-orin-nano.sh            # NVIDIA Jetson Orin Nano setup
│   ├── setup-spark.sh                # DGX Spark setup
│   ├── start-services.sh             # Start Telegram bridge + cloudflared tunnel
│   ├── walkthrough.sh                # Split-screen agent approval workflow demo
│   │
│   ├── nemoclawd-start.sh            # Sandbox entrypoint — configures gateway + dashboard
│   ├── nemoclawd-solana-agent.sh     # Pump-Fun Solana tracker bot
│   ├── nemoclawd-solana-bridge.sh    # Solana-Telegram real-time wallet bridge
│   ├── nemoclawd-solana-stack.sh     # One-shot Solana operator stack (bot + bridge + websocket)
│   ├── nemoclawd-telegram-bot.sh     # Pump-Fun Telegram bot runner
│   ├── nemoclawd-swarm-bot.sh        # Pump-Fun swarm dashboard runner
│   ├── nemoclawd-websocket-server.sh # Pump-Fun WebSocket relay
│   ├── nemoclawd-payment-app.sh      # Tokenized agent payment app
│   ├── nemoclawd-agent-registry.sh   # 8004 Solana Agent Registry + heartbeat
│   │
│   ├── pre-commit-secrets.sh         # Pre-commit hook — blocks secret leakage
│   ├── public-release-audit.sh       # Pre-release security audit
│   ├── test-inference.sh             # Inference routing test
│   ├── test-inference-local.sh       # Local inference routing test
│   ├── fix-coredns.sh                # Fix CoreDNS in Colima/k3s gateways
│   ├── install-openshell.sh          # OpenShell CLI binary installer
│   ├── build_training_data.py        # Training data builder
│   ├── telegram-bridge.js            # Telegram → gateway bridge
│   └── write-auth-profile.py         # Auth profile writer
│
├── services/                         # Docker Compose microservices
│   ├── README.md
│   ├── automation/                   # Workflow automation service
│   ├── clawd-bot/                    # Clawd Telegram/Discord bot
│   ├── clawd-box/                    # Clawd execution sandbox
│   ├── clawd-operator/               # Clawd operator dashboard
│   ├── clawd-pay/                    # x402 payment gateway
│   ├── clawdrouter/                  # CLawd routing service
│   ├── cloudflared-tunnel/           # Cloudflare tunnel for public access
│   ├── gateway/                      # AI gateway service
│   ├── inference-mesh/               # Distributed inference mesh
│   ├── livekit-agent/                # LiveKit voice agent
│   └── merchant/                     # Merchant payment service
│
├── core-ai/                          # AI model integrations
│   ├── CLAUDE.md CLAWD.md AGENTS.md
│   ├── clawd-code/                   # Clawd Code integration
│   ├── clawd-grok/                   # Grok AI integration
│   ├── clawd-perps-agent/            # Perpetuals trading agent
│   ├── convex/                       # Convex backend
│   ├── docs/                         # AI docs and references
│   ├── helius-cli/                   # Helius RPC CLI
│   ├── helius-cursor/                # Helius Cursor extension
│   ├── helius-mcp/                   # Helius MCP server
│   ├── helius-plugin/                # Helius plugin
│   ├── helius-skills/                # Helius agent skills
│   ├── knowledge/                    # Knowledge base files
│   ├── mcp-server/                   # MCP server configs
│   ├── scripts/                      # AI-specific scripts
│   └── v3/                           # V3 agent framework
│
├── deploy/
│   └── fly/                          # ** Fly.io deployment (you are here) **
│       ├── Dockerfile                # Production image (Node 22 + Solana CLI)
│       ├── entrypoint.sh             # Boots wrapper + seeds from Fly secrets
│       ├── deploy.sh                 # One-command deploy script (prompts, builds, deploys)
│       ├── fly.toml.template         # Fly.io config template
│       ├── wrapper/                  # Wrapper server source
│       │   ├── package.json
│       │   └── server.js             # Express server: /setup, /healthz, proxy to gateway
│       └── README.md
│
├── docs/                             # Sphinx documentation site
│   ├── index.md conf.py
│   ├── about/ deployment/ get-started/ inference/
│   ├── monitoring/ network-policy/ reference/ resources/
│   └── CONTRIBUTING.md
│
├── training-data/                    # Training datasets and evaluation
│   ├── README.md
│   ├── corpus/                       # Training corpus
│   ├── eval/                         # Evaluation datasets
│   ├── manifests/                    # Data manifests
│   ├── preference/                   # Preference data for RL
│   └── reports/                      # Training reports
│
├── zk-primitives/                    # Zero-knowledge primitives
│
├── spinners/                         # 44 themed spinner verb packs
│   ├── README.md SKILL.md            # Docs + agent skill
│   ├── metadata.json                 # Spinner catalog
│   └── *.json                        # Each spinner (90s-kid, bob-ross, chaos,
│                                     #   cowboy, detective, gordon-ramsay, gym-bro,
│                                     #   jack-sparrow, michael-scott, shakespeare,
│                                     #   sherlock-holmes, vim, yoda, zombie, ...)
│
├── site/                             # Static site (landing page)
│   ├── index.html
│   └── NemoClawd.code-workspace      # VS Code workspace file
│
├── test/                             # Test suite
│   ├── cli.test.js                   # CLI integration tests
│   ├── dflow-routing.test.js         # DFlow routing tests
│   ├── magic-router.test.js          # Magic router tests
│   ├── install-preflight.test.js     # Preflight install checks
│   ├── policies.test.js              # Policy tests
│   ├── preflight.test.js             # Preflight tests
│   ├── registry.test.js              # Agent registry tests
│   ├── runner.test.js                # Runner tests
│   ├── nim.test.js                   # NVIDIA NIM tests
│   ├── Dockerfile.sandbox            # Test sandbox image
│   ├── e2e-test.sh                   # End-to-end test runner
│   └── e2e/                          # E2E test scenarios
│
└── netlify.toml                      # Netlify deployment config
```

### Key entry points

| What | Path |
|------|------|
| **Main CLI** | `bin/nemoclawd.js` (package `@mawdbotsonsolana/nemoclawd`) |
| **MCP Server** (32 tools) | `nemo-clawd-mcp/` |
| **MCP HTTP deploy** | `nemo-clawd-mcp/fly.toml` — standalone MCP Fly deploy |
| **Python SDK** | `nemo-clawd-python/` |
| **Fly.io deploy** (this doc) | `deploy/fly/` |
| **Core AI integrations** | `core-ai/` (Grok, Claude, Helius, Convex, perps) |
| **Service Compose** | `services/` (gateway, bot, pay, tunnel, mesh) |
| **Setup scripts** | `scripts/setup.sh`, `scripts/install.sh` |
| **Training data** | `training-data/` |
| **ZK primitives** | `zk-primitives/` |
| **Spinner packs** | `spinners/` (44 themed verb packs) |
| **Docs** | `docs/` (Sphinx) |
| **Tests** | `test/` |

### What gets deployed to Fly.io

The Docker image in `deploy/fly/Dockerfile` includes:

- **Node.js 22** runtime with the full `@mawdbotsonsolana/nemoclawd` CLI
- **Solana CLI tools** (solana, solana-keygen, solana-test-validator, spl-token)
- **Python 3** with PyYAML for config scripts
- **The wrapper server** (`deploy/fly/wrapper/server.js`) — Express app with `/setup` wizard, `/healthz`, and Nemo Clawd gateway proxy
- **All scripts** from `scripts/` made available as system commands
- **ZK primitives** from `zk-primitives/`
- **Spinners** from `spinners/`
- **MCP server binaries** from `nemo-clawd-mcp/`
- **Python SDK** from `nemo-clawd-python/`

---

## Configuration

### Secrets

All sensitive values are stored as Fly secrets, encrypted at rest and injected as environment variables at boot.

| Secret | Required | Description |
|--------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Protects the `/setup` wizard |
| `NEMOCLAWD_GATEWAY_TOKEN` | Yes | Auth token for gateway connections (auto-generated) |
| `NEMOCLAWD_API_KEY` | Yes | Your LLM provider API key |
| `NEMOCLAWD_AUTH_CHOICE` | Yes | Provider identifier (set by deploy script) |
| `NEMOCLAWD_DISCORD_TOKEN` | No | Discord bot token |
| `NEMOCLAWD_TELEGRAM_TOKEN` | No | Telegram bot token |
| `NEMOCLAWD_SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) |
| `NEMOCLAWD_SLACK_APP_TOKEN` | No | Slack app token (`xapp-...`) |
| `SOLANA_RPC_URL` | No | Custom Solana RPC endpoint |
| `HELIUS_API_KEY` | No | Helius RPC API key |
| `PRIVY_APP_ID` | No | Privy agentic wallet app ID |
| `PRIVY_APP_SECRET` | No | Privy agentic wallet app secret |

To update a secret after deployment:

```bash
fly secrets set NEMOCLAWD_API_KEY=sk-new-key-here -a your-app-name
```

The Machine restarts automatically when secrets change.

### VM sizing

Default: `shared-cpu-2x` with 4 GB RAM (~$20-25/month when running continuously). With auto-stop enabled (the default), you only pay for time the Machine is running.

```bash
fly scale memory 4096 -a your-app-name
fly scale vm shared-cpu-4x -a your-app-name
```

### Persistent storage

Nemo Clawd stores all state on a Fly Volume mounted at `/data`:

- `nemoclawd.json` — wrapper configuration
- `.nemoclawd/` — Nemo Clawd gateway config, conversation history, context
- `.nemoclawd/wallets/` — wallet data (encrypted)
- `.nemoclawd/vault/` — append-only JSONL trade and heartbeat logs

Default volume size is 1 GB. To extend:

```bash
fly volumes extend <volume-id> -s 3 -a your-app-name
```

---

## Useful commands

| Command | Description |
|---------|-------------|
| `fly logs -a your-app` | Stream live logs |
| `fly ssh console -a your-app` | SSH into the Machine |
| `fly apps restart your-app` | Restart after config changes |
| `fly scale memory 4096 -a your-app` | Increase memory |
| `fly status -a your-app` | Check Machine status |
| `fly volumes list -a your-app` | List attached volumes |

---

## Troubleshooting

**"SETUP_PASSWORD is not set"**
```bash
fly secrets set SETUP_PASSWORD=your-password -a your-app-name
```

**Out of memory / crashes**
```bash
fly scale memory 4096 -a your-app-name
```

**Gateway won't start** — visit `/setup` and check the logs section. Common causes: invalid API key, missing config, or corrupted state.

**Lock file errors**
```bash
fly ssh console -a your-app-name
rm -f /data/gateway.*.lock
exit
fly apps restart your-app-name
```

**Need to start fresh** — use the "Reset" button in the setup wizard, or:
```bash
fly ssh console -a your-app-name
rm /data/nemoclawd.json
exit
fly apps restart your-app-name
```

---

## Supported LLM providers

| Provider | What you need |
|----------|---------------|
| Anthropic | API key from [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | API key from [platform.openai.com](https://platform.openai.com) |
| NVIDIA | API key from [build.nvidia.com](https://build.nvidia.com) |
| Google Gemini | API key from [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | API key from [openrouter.ai](https://openrouter.ai) |
| Moonshot AI | API key from Moonshot's developer portal |
| MiniMax | API key from MiniMax's developer portal |

You can switch providers at any time through the setup wizard — no redeployment needed.