# Solana Clawd Services

This directory vendors the Solana Clawd service layer into Nemo Clawd.

Imported source services:

- `gateway`: Telegram bot and HTTP gateway with Solana, Helius, Birdeye, x402, and agent-registry integrations.
- `inference-mesh`: distributed inference mesh service and Vite dashboard.
- `clawdrouter`: Solana-native LLM router with wallet signing, routing tiers, and x402 payment helpers.
- `clawd-operator`: Python operator/orchestrator service.
- `livekit-agent`: Python LiveKit voice agent.
- `cloudflared-tunnel`: Fly.io tunnel wrapper.
- `automation`: upstream bootstrap/check scripts retained as reference automation.
- `clawd-bot`, `clawd-pay`, `merchant`, `clawd-box`: service placeholders and documentation.

Runtime state and generated artifacts are intentionally not imported:

- `.env`, `.env.local`, logs, caches, `node_modules`, and `dist`
- Python `__pycache__` and compiled bytecode
- operator `.agent` cache and clawdrouter `.surfpool` state

Root npm helpers:

```bash
npm run services:install
npm run services:build
npm run services:test
```

Use each service's own README for environment variables and deployment commands.
