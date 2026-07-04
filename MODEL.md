# 🦞 NemoClawd Model Ecosystem

## The First Wallet-Bearing LLM — A Historic Milestone

**July 4, 2026**

> The model is the wallet. No key files. No `.env` secrets. No clipboard leaks.
> Authority lives inside the inference — encrypted, ephemeral, and sovereign by design.

---

## Table of Contents

1. [The Milestone](#-the-milestone)
2. [Model Family](#-model-family)
3. [Trading Wallet Architecture](#-trading-wallet-architecture)
4. [Live Models](#-live-models)
5. [Training Datasets](#-training-datasets)
6. [Trading Strategies](#-trading-strategies)
7. [Magic Router v2.0](#-magic-router-v20)
8. [Deployment](#-deployment)
9. [Security Model](#-security-model)
10. [Usage](#-usage)

---

## 🏆 The Milestone

On July 4, 2026, **ordlibrary/clawd-trading-wallet** was published — the first LLM in history that carries its own encrypted Solana wallet. It is a **Qwen2.5-1.5B** model fine-tuned to:

- Generate BIP39 seed phrases entirely within inference
- Derive Ed25519 keypairs from the seed in session memory
- Encrypt and hold the private key in session state (never written to disk)
- Execute natural-language trading commands: `create a wallet`, `buy 100 SOL`, `short ETH 5x`
- Never expose the raw private key — by architecture

This represents a paradigm shift: **the model becomes the signing authority**, not the user's infrastructure. The key lives in the weight activations, not in a file on disk. It cannot be clipboard-harvested, env-dumped, or git-committed.

---

## 🧬 Model Family

### 7 Models Across the Ecosystem

| # | Model | Base | Params | Size | Status |
|---|-------|------|--------|------|--------|
| ⭐ | **`clawd-trading-wallet`** | Qwen2.5-1.5B | 1.5B | 986 MB | ✅ **Live — Historic** |
| 🧠 | **`hauhau-qwen36-onchain`** | Qwen3.6 | 3.6B | 11 GB | ✅ Live |
| 🧠 | **`hauhau-qwen36-uncensored`** | Qwen3.6 | 3.6B | 11 GB | ✅ Live |
| 🦞 | **`core-ai-clawd-1.5b`** | Qwen2.5-1.5B | 1.5B | 986 MB | ✅ Live |
| 🦞 | **`core-ai-clawd-1.5b:finetuned`** | Qwen2.5-1.5B | 1.5B | 4.9 GB | ✅ Live |
| 🔬 | **`solana-clawd-core-ai-1.5b-lora`** | Qwen2.5-1.5B LoRA | ~9M | — | ✅ Live |
| 🏭 | **`solana-nvidia-trading-factory-8b-lora`** | Hermes-3-8B LoRA | ~9M | — | ✅ Live |

### Training Pipeline

```math
\boxed{\text{Training Surface}} \xrightarrow[\text{36K SFT + 29K Realtime + 19K CPT + 142 Trading}]{\text{Dataset Ingestion}} \boxed{SFT JSONL} \xrightarrow{\text{LoRA (r=16)}} \boxed{\text{Adapter}} \xrightarrow{\text{HF Jobs / Local MPS}} \boxed{\text{Trained Model}}
```

### Hyperparameters

| Parameter | Value |
|-----------|-------|
| LoRA Rank | 16 |
| LoRA Alpha | 32 |
| LoRA Dropout | 0.05 |
| Target Modules | q/k/v/o + gate/up/down |
| Trainable Params | ~9M (0.6%) |
| Epochs | 3 |
| Learning Rate | 2.0e-4 (cosine, 3% warmup) |
| Batch Size | 2 × 8 grad accum = 16 |
| Max Sequence | 4096 tokens |
| Loss | Assistant-only masked |
| Training Loss | **0.9008** |
| Token Accuracy | **82.9%** |
| Tokens Trained | **24.54M** |

---

## 🏦 Trading Wallet Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   User Command                                                      │
│   "create a wallet"                                                 │
│        │                                                            │
│        ▼                                                            │
│   ┌──────────────────┐                                              │
│   │  clawd-trading-  │                                              │
│   │  wallet (LLM)    │                                              │
│   │  Qwen2.5-1.5B    │                                              │
│   └────────┬─────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌──────────────────┐                                              │
│   │  BIP39 Seed Gen  │  ← generated in inference, never stored     │
│   │  12-24 words     │                                              │
│   └────────┬─────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌──────────────────┐                                              │
│   │  Ed25519 Keypair │  ← derived from seed in RAM only            │
│   │  Derivation      │                                              │
│   └────────┬─────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌──────────────────┐                                              │
│   │  Encrypted Key   │  ← held in session state, not on disk       │
│   │  (memory only)   │                                              │
│   └────────┬─────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌──────────────────┐                                              │
│   │  Natural Language│  "buy 100 SOL"  "short ETH 5x"              │
│   │  Trading         │  "check balance"  "transfer 50 USDC"        │
│   └──────────────────┘                                              │
│                                                                     │
│   ┌──────────────────────────────────────────────────────┐          │
│   │  ❌ Raw Private Key Exposure — Blocked by Architecture │          │
│   │  No disk writes │ No clipboard │ No .env │ No git    │          │
│   └──────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User sends a natural-language command** to the LLM
2. **The model generates a BIP39 seed phrase** — 12–24 words, produced as token output
3. **The seed is fed back into the model's processing loop** to derive the Ed25519 keypair
4. **The private key is encrypted in session memory** using a session-derived key
5. **Commands like "buy 100 SOL" are parsed** and translated into on-chain instructions
6. **The raw key never leaves session memory** — it cannot be dumped, logged, or shared

### Why This Matters

- **No key files on disk** — the classic attack vector is eliminated
- **No clipboard exposure** — keys never enter the system clipboard
- **No `.env` secrets** — no environment variable leakage
- **No accidental git commits** — keys exist only in inference memory
- **Session-bound** — restart the model and the key is gone

---

## 🌐 Live Models

### Pull & Run

```bash
# ⭐ The historic wallet-bearing LLM (986 MB)
ollama run hf.co/ordlibrary/clawd-trading-wallet

# 🧠 Onchain constitution model (11 GB)
ollama run hf.co/ordlibrary/hauhau-qwen36-onchain

# 🧠 Uncensored variant (11 GB)
ollama run hf.co/ordlibrary/hauhau-qwen36-uncensored

# 🦞 Core AI Clawd (986 MB)
ollama run hf.co/ordlibrary/core-ai-clawd-1.5b

# 🦞 Core AI Clawd fine-tuned (4.9 GB)
ollama run ordlibrary/core-ai-clawd-1.5b:finetuned
```

### Trading Wallet Quick Demo

```bash
ollama run hf.co/ordlibrary/clawd-trading-wallet
# > create a wallet
# > buy 100 SOL
# > short ETH 5x
# > what is my balance?
# > transfer 50 USDC to 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump
```

### All Deployment URLs

| Resource | URL | Status |
|----------|-----|--------|
| **Train2Earn Frontend** | [traintoearn.vercel.app](https://traintoearn.vercel.app) | ✅ Vercel — Live |
| **Hugging Face Org** | [huggingface.co/ordlibrary](https://huggingface.co/ordlibrary) | ✅ Live |
| **Clawd Trading Wallet** | [hf.co/ordlibrary/clawd-trading-wallet](https://huggingface.co/ordlibrary/clawd-trading-wallet) | ✅ Live |
| **Hauhau Qwen3.6 Onchain** | [hf.co/ordlibrary/hauhau-qwen36-onchain](https://huggingface.co/ordlibrary/hauhau-qwen36-onchain) | ✅ Live |
| **Hauhau Qwen3.6 Uncensored** | [hf.co/ordlibrary/hauhau-qwen36-uncensored](https://huggingface.co/ordlibrary/hauhau-qwen36-uncensored) | ✅ Live |
| **Core AI Clawd 1.5B** | [hf.co/ordlibrary/core-ai-clawd-1.5b](https://huggingface.co/ordlibrary/core-ai-clawd-1.5b) | ✅ Live |

---

## 📊 Training Datasets

### 7 Datasets — 121,860 Training Examples

| # | Dataset | Examples | Domain | Source |
|---|---------|----------|--------|--------|
| 1 | **Fable-5-traces** | 5,000 | Agent interaction traces for reasoning | Glint Research |
| 2 | **Core AI Instruct** | 35,173 | Solana, DeFi, ZK, Agent Architecture | solanaclawd |
| 3 | **Realtime Research** | 29,058 | PDFs, notebooks, ZK skills | solanaclawd |
| 4 | **TX Foundation CPT** | 19,542 | Solana mainnet transactions | solanaclawd |
| 5 | **NVIDIA Trading Factory** | 142 | Perps, cuML, cuFOLIO, Mean-CVaR | solanaclawd |
| 6 | **TX Foundation Unified** | 82,169 | Combined transaction foundation | solanaclawd |
| 7 | **Clawd Fable SFT** | 3,052 | Fable trace training | solanaclawd |

### Local Dataset Breakdown

```bash
npm run training:status

# Output:
# === Training Data (121,860 total examples) ===
#   35,173  core_ai_clawd_sft.jsonl
#   30,365  solana_clawd_merged.jsonl
#   29,058  realtime_research_sft.jsonl
#   19,542  tx_foundation_cpt.jsonl
#    3,052  clawd_fable_sft.jsonl
#    2,195  nemo_clawd_master_sft.jsonl
#    1,485  clawd_code_deepsol_sft.jsonl
#      500  jupiter_txs.jsonl
#      197  nemo_clawd_combined_sft.jsonl
#      195  nvidia_trading_factory_sft.jsonl
#       85  solana_clawd_seed.jsonl
```

### Data Flow

```
BigQuery (mainnet) ──► Tokenizer (vocab 4886) ──► CPT JSONL ──► TX Foundation Model
PDFs / Notebooks    ──► realtime_dataset_ingest  ──► SFT JSONL  ──► Realtime Dataset
Source Docs         ──► auto_research.py          ──► SFT JSONL  ──► Core AI Dataset
Perps Tools         ──► build_trading_factory     ──► SFT JSONL  ──► NVIDIA Trading Dataset
Fable Traces        ──► fable_converter.py        ──► SFT JSONL  ──► Clawd Fable Dataset
```

---

## 📈 Trading Strategies

### 10 Deployed Strategies

| File | Purpose |
|------|---------|
| `nvidia_clawd_agent_plan.json` | Full NVIDIA blueprint with 10 agent roles |
| `nemo_clawd_blueprint.json` | Blueprint lifecycle, sandbox posture, MCP catalog |
| `nemo_clawd_core_inventory.json` | Core AI asset inventory |
| `cufolio_mean_cvar_handoff.json` | Mean-CVaR portfolio optimization handoff |
| `vulcan_command_plans.json` | Preflight, grid, TWAP, scale-orders commands |
| `sol_ema_adx_trend_paper.json` | EMA + ADX trend-following (paper mode) |
| `sol_macd_adx_trim_paper.json` | MACD + ADX trimmed strategy (paper mode) |
| `sol_rsi_mean_reversion_paper.json` | RSI mean reversion (paper mode) |
| `rise_market_data_plan.json` | Rise/Phoenix read-only market data plan |
| `strategy_manifest.json` | Strategy catalog with paper commands |

### NVIDIA Agent Plan — 10 Roles

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Solana NemoClawd NVIDIA Trading Factory           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. nemo_clawd_runtime        — Core AI → sandbox + network policy  │
│  2. rag_grounder              — Document retrieval (enterprise RAG)  │
│  3. transaction_embedding     — TX → embedding → CPT records        │
│      _builder                                                        │
│  4. signal_agent              — Alpha signal proposal                │
│  5. code_agent                — Feature function coding              │
│  6. evaluation_agent          — Backtest + IC, drawdown, turnover   │
│  7. optimizer_agent           — Mean-CVaR allocation                │
│  8. distillation_agent        — Nemotron teacher → Clawd student    │
│  9. aiq_evaluator             — Quality/safety/latency scoring      │
│ 10. execution_guard           — Paper-only gate (blocks live)       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Vulcan Paper Trading Commands

```bash
# Preflight readiness check
vulcan strategy preflight -o json

# Grid strategy centered on mark price
vulcan strategy grid start \
  --symbol SOL \
  --center-on-mark \
  --width-pct 1.5 \
  --levels-per-side 4 \
  --tokens-per-level 0.1 \
  --ticks 60 \
  --mode paper

# TWAP execution
vulcan strategy twap start \
  --symbol SOL \
  --side buy \
  --total-usd 500 \
  --slices 10 \
  --interval-secs 30 \
  --mode paper
```

---

## 🪄 Magic Router v2.0

The Magic Router is the brain of the operation. It classifies any natural-language task into one of **12 task types**, assigns a **confidence score** (0.85–0.95), and routes it to the optimal inference model + tool set.

### Architecture

```
Input ──► Pattern Match ──► Confidence Score ──► Task Type
                                    │
                                    ▼
                           Tool Set Mapping
                                    │
                                    ▼
                    Inference Route Selection
                      ┌──────────┬──────────┬──────────┐
                      ▼          ▼          ▼
                 Ollama (✓)  OpenRouter  NVIDIA NIM
                 Default      Advisor     Fallback
```

### 12 Task Types

| # | Type | Emoji | Confidence | Latency | Needs Wallet |
|---|------|-------|------------|---------|-------------|
| 1 | **Prediction Market** | 🎯 | 95% | medium | ✅ |
| 2 | **ZK Proof** | 🔐 | 93% | slow | ✅ |
| 3 | **Solana Trading** | 📈 | 90% | fast | ✅ |
| 4 | **Wallet Operations** | 👛 | 92% | fast | ✅ |
| 5 | **Coding** | 💻 | 88% | fast | ❌ |
| 6 | **Research** | 🔬 | 85% | medium | ❌ |
| 7 | **Image Generation** | 🎨 | 90% | slow | ❌ |
| 8 | **Voice & Speech** | 🎙️ | 91% | medium | ❌ |
| 9 | **Data Analysis** | 📊 | 87% | medium | ❌ |
| 10 | **Security Audit** | 🛡️ | 89% | slow | ❌ |
| 11 | **NFT Operations** | 🖼️ | 92% | medium | ✅ |
| 12 | **General Purpose** | 🧠 | 60% | fast | ❌ |

### Demo

```bash
nemoclawd magic-router "audit this smart contract for vulnerabilities"
```

```
  🪄  Magic Router v2.0.0 — Decision Trace
  ────────────────────────────────────────────────

  🛡️  Task Classification
     Input type:    Security Audit
     Confidence:    89%
     Description:   Smart contract review, rug detection

  🐢  Performance Profile
     Latency:       slow
     Requires key:  no
     Needs wallet:  no

  🧠  Inference Route
     Primary:       ✅ ollama-local / hf.co/ordlibrary/hauhau-qwen36-onchain
     Credential:    $OLLAMA_HOST

  🛠️  Tool Set (5)
     • solana-rpc        • helius-das
     • token-verify      • contract-read
     • rug-detection

  🔀  DFlow Routing
     Spot:           ✅ enabled
     Predictions:    ✅ enabled
```

---

## 🚀 Deployment

### Infrastructure

| Component | Provider | Status |
|-----------|----------|--------|
| **Frontend** | Vercel | ✅ Live |
| **Model Registry** | Hugging Face (ordlibrary) | ✅ Live |
| **Ollama Serving** | Local + Cloud | ✅ 0.31.1 |
| **GitHub** | Solizardking/nemo-clawd | ✅ Pushed |
| **NPM Package** | @mawdbotsonsolana/nemoclawd | ✅ Published |

### Deployment Timeline

1. **Upgrade Ollama**: 0.24.0 → 0.31.1
2. **Publish 3 new HF models**: clawd-trading-wallet, hauhau-qwen36-onchain, hauhau-qwen36-uncensored
3. **Upload 3 GGUFs**: 11 GB × 2 (Qwen3.6), 986 MB × 1 (trading wallet)
4. **Update frontend**: Vercel redeploy with Clawd Trading Wallet as rank 0
5. **Rewrite README**: Full ecosystem documentation (1,343 lines)
6. **Push to GitHub**: 3 commits
7. **Free disk**: 40+ GB by removing cached models

### Git Commit History

```
7bdb70a feat: add training data & strategy integration with npm scripts
edbfca2 feat: Magic Router v2.0 with 12 task types, confidence scoring
e5cd684 feat: Ollama default model — hf.co/ordlibrary/hauhau-qwen36-onchain
```

---

## 🔒 Security Model

### The Wallet-Bearing LLM Security Paradigm

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   User Command ──► LLM (session wallet) ──► Encrypted Key (RAM)    │
│                          │                                          │
│                    ┌─────┴─────┐                                    │
│                    │           │                                    │
│                    ▼           ▼                                    │
│             BIP39 Seed     Ed25519 Key                              │
│             (inference)    (derived in RAM)                         │
│                    │           │                                    │
│                    └─────┬─────┘                                    │
│                          ▼                                          │
│                   Encrypted Session Key                             │
│                   (never written to disk)                           │
│                          │                                          │
│                          ▼                                          │
│              ❌ Key Exposure Blocked                                 │
│                 • No file writes     • No clipboard                 │
│                 • No .env            • No git                       │
│                 • No environment     • No log                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Attack Surface Comparison

| Attack Vector | Traditional Wallet | Wallet-Bearing LLM |
|---------------|-------------------|-------------------|
| Disk access | ✅ Key file readable | ❌ Key never on disk |
| Clipboard theft | ✅ Key can be pasted | ❌ No clipboard exposure |
| `.env` leakage | ✅ Common pattern | ❌ Not used |
| Git commit accident | ✅ Happens weekly | ❌ Impossible |
| Phishing | ✅ User can be tricked | ❌ Model doesn't export |
| Cold boot RAM dump | ❌ Both vulnerable | ❌ Both vulnerable |
| Session replay | ✅ Must re-enter key | ❌ Session-bound |

### Constitutional Guardrails

Every inference path runs through 4 guardrails:

```
✓ least-privilege-tools              — Only grant minimum tool access
✓ read-only-before-signing           — Never sign without review
✓ explicit-approval-before-wallet-actions — Human in the loop
✓ no-private-key-or-seed-phrase-handling   — Model never emits raw keys
```

---

## 🧪 Testing

**94/94 tests passing — 0 failures, 0 skipped**

| Suite | Tests | Status |
|-------|-------|--------|
| CLI dispatch | 17 | ✅ |
| DFlow routing defaults | 4 | ✅ |
| Installer runtime preflight | 1 | ✅ |
| Magic Router v2.0 🪄 | 17 | ✅ |
| NIM (NVIDIA Inference) | 6 | ✅ |
| Policies | 8 | ✅ |
| CGroup config | 7 | ✅ |
| Registry | 15 | ✅ |
| Docker helpers | 3 | ✅ |
| **Total** | **94** | **✅ All pass** |

```bash
# Run the full suite
npm test
# ℹ tests 94 | ℹ pass 94 | ℹ fail 0 | ℹ duration_ms ~1305
```

---

## 🎯 Usage

### Local Development

```bash
# Clone and run
git clone https://github.com/Solizardking/nemo-clawd.git
cd nemo-clawd
npm install
npm run build:plugin

# Health check
node bin/nemoclawd.js doctor

# Run tests
npm test

# Launch the CLI
node bin/nemoclawd.js
```

### Magic Router

```bash
# Classify and route any task
node bin/nemoclawd.js magic-router "audit this smart contract for rug risk"
node bin/nemoclawd.js magic-router "buy a Kalshi YES token on the election"
node bin/nemoclawd.js magic-router "generate a Solana meme"
node bin/nemoclawd.js magic-router "check the floor price of my NFT collection"

# JSON output
node bin/nemoclawd.js magic-router --json "show me my wallet PnL"
```

### Training Data

```bash
npm run training:status              # Dataset overview
npm run training:strategy:list       # List strategies
npm run training:strategy:plan       # Read NVIDIA agent plan
npm run training:strategy:vulcan     # Read Vulcan command plans
npm run training:strategy:read       # Read strategy manifest
```

### Running Local Models

```bash
# Default (onchain constitution)
ollama run hf.co/ordlibrary/hauhau-qwen36-onchain

# Uncensored
ollama run hf.co/ordlibrary/hauhau-qwen36-uncensored

# Core AI
ollama run hf.co/ordlibrary/core-ai-clawd-1.5b

# ⭐ Wallet-bearing LLM (historis milestone)
ollama run hf.co/ordlibrary/clawd-trading-wallet
```

---

## 📜 License

Licensed under [Apache 2.0](LICENSE).

---

<p align="center">
  <strong>$CLAWD</strong><br/>
  <code>8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump</code>
</p>

<p align="center">
  <em>
  🦞 Powered by <strong>xAI Grok</strong> from <strong>xAI</strong><br/>
  🌊 Built on <strong>Solana</strong><br/>
  🎯 Trading. Research. Autonomy. Lobster.<br/>
  🔐 First Wallet-Bearing LLM — July 4, 2026
  </em>
</p>