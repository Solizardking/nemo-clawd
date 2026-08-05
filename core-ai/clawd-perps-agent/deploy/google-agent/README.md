# Deploy Clawd Perps Agent to Google Cloud Run

This directory contains everything needed to deploy the Clawd Perps Agent to **Google Cloud Run**, which can then be registered as a tool in **Vertex AI Agent Builder**.

## Architecture

```
Vertex AI Agent Builder
         │
         ▼  HTTP POST { tool_name, tool_args }
┌─────────────────────────────────┐
│  Cloud Run: clawd-perps-agent   │
│  ┌───────────────────────────┐  │
│  │  Express HTTP Server      │  │
│  │  google-server.ts         │  │
│  │                           │  │
│  │  ├── /health              │  │
│  │  ├── /agent/tools         │  │
│  │  ├── /agent:query         │  │
│  │  ├── /agent/tool          │  │
│  │  ├── /openapi.json        │  │
│  │  └── / (catch-all)        │  │
│  └──────────┬────────────────┘  │
│             │                    │
│  ┌──────────▼────────────────┐  │
│  │  ClawdPerpsRuntime        │  │
│  │  (Rise SDK + Hawkeye)     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         ▼  HTTPS + Solana RPC
   Phoenix Perps (perp-api.phoenix.trade)
```

## Available Tools (18 total)

| Tool | Description |
|------|-------------|
| `perps_list_markets` | List all markets with prices, funding, volume |
| `perps_get_ticker` | Single market snapshot |
| `perps_get_orderbook` | L2 orderbook |
| `perps_get_candles` | OHLCV candle history |
| `perps_get_funding` | Funding rates |
| `perps_get_market_stats` | Full market statistics |
| `perps_get_bbo` | Best bid/offer via Hawkeye on-chain simulation |
| `perps_get_margin` | Margin status (Hawkeye) |
| `perps_get_positions` | Open positions |
| `perps_get_trader_snapshot` | Full trader state |
| `perps_market_order` | Build unsigned market order instructions |
| `perps_limit_order` | Build unsigned limit order instructions |
| `perps_stop_loss` | Build unsigned stop loss instructions |
| `perps_cancel_orders` | Cancel orders |
| `perps_deposit` | Build unsigned deposit instructions |
| `perps_withdraw` | Build unsigned withdraw instructions |
| `imperial_health` | Imperial Trading API health |

## Prerequisites

- Google Cloud project with **Cloud Run**, **Artifact Registry**, **Secret Manager** APIs enabled
- `gcloud` CLI installed and authenticated

## Step 1: Deploy to Cloud Run

```bash
# Navigate to the perps agent root
cd /Users/8bit/drive/nemo-clawd/core-ai/clawd-perps-agent

# Deploy to Cloud Run using Cloud Build
gcloud builds submit --config deploy/google-agent/cloudbuild.yaml
```

Or deploy directly with `gcloud run deploy`:

```bash
gcloud run deploy clawd-perps-agent \
  --source=. \
  --region=us-central1 \
  --execution-environment=gen2 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --cpu=2 \
  --memory=1Gi \
  --timeout=300 \
  --set-env-vars=PERPS_SIM_ONLY=true,NODE_ENV=production
```

## Step 2: Set up secrets

```bash
# Create secrets in Secret Manager
gcloud secrets create SOLANA_RPC_URL --replication-policy=automatic
echo -n "https://api.mainnet-beta.solana.com" | gcloud secrets versions add SOLANA_RPC_URL --data-file=-

gcloud secrets create HELIUS_API_KEY --replication-policy=automatic
echo -n "your-helius-api-key" | gcloud secrets versions add HELIUS_API_KEY --data-file=-

# Attach secrets to the Cloud Run service
gcloud run services update clawd-perps-agent \
  --region=us-central1 \
  --update-secrets=SOLANA_RPC_URL=SOLANA_RPC_URL:latest \
  --update-secrets=HELIUS_API_KEY=HELIUS_API_KEY:latest
```

## Step 3: Verify deployment

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe clawd-perps-agent --region=us-central1 --format='value(status.url)')

# Test health
curl $SERVICE_URL/health

# Test tool discovery
curl $SERVICE_URL/agent/tools

# Test a tool
curl -X POST $SERVICE_URL/agent:query \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"perps_list_markets","tool_args":{}}'
```

## Step 4: Register with Vertex AI Agent Builder

After deploying to Cloud Run, register the service as an Agent tool in Vertex AI:

### Option A — Via Google Cloud Console
1. Go to **Vertex AI > Agent Builder** in the Google Cloud Console
2. Create a new agent or open an existing one
3. Add a **Tool** → **OpenAPI** → enter your Cloud Run URL + `/openapi.json`
4. The 18 perps tools will be auto-discovered from the OpenAPI spec

### Option B — Via gcloud (if supported in your project)
```bash
gcloud ai agents import \
  --project=$(gcloud config get-value project) \
  --region=us-central1 \
  --source=<your-agent-config>
```

### Option C — Direct HTTP integration
Your Vertex AI agent can call the tools via:
```
POST {service-url}/agent:query
Content-Type: application/json

{
  "tool_name": "perps_get_orderbook",
  "tool_args": {
    "symbol": "SOL",
    "depth": 20
  }
}
```

## Local Development

```bash
cd /Users/8bit/drive/nemo-clawd/core-ai/clawd-perps-agent
npm install
npm run build

export PERPS_SIM_ONLY=true
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
node dist/server.js

# Test
curl http://localhost:8080/health
curl -X POST http://localhost:8080/agent:query \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"perps_list_markets","tool_args":{}}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `HELIUS_API_KEY` | No | Helius RPC API key |
| `CLAWD_PERPS_API_URL` | No | Phoenix API URL (default: https://perp-api.phoenix.trade) |
| `CLAWD_PERPS_WALLET` | No | Wallet pubkey for trader operations |
| `PERPS_SIM_ONLY` | No | Safe mode (default: true) |
| `LIVE_TRADING` | No | Enable live execution (default: false) |
| `OPERATOR_CONFIRMED` | No | Operator confirmation (default: false) |
| `PORT` | No | HTTP port (default: 8080) |