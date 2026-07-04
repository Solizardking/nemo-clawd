<!-- start-badges -->
<p align="center">
  <strong>nemoclawd</strong><br/>
  <em>Solana x xAI Agentic Trading Engine — Powered by $CLAWD</em>
</p>
<p align="center">
  <code>8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump</code>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/@mawdbotsonsolana/nemoclawd"><img src="https://img.shields.io/npm/v/@mawdbotsonsolana/nemoclawd.svg?style=flat-square&color=cb3837" alt="npm"></a>
  <a href="https://github.com/x402agent/nemo-clawd/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/xAI-Grok%204.20-black?style=flat-square&logo=x" alt="xAI Grok">
  <img src="https://img.shields.io/badge/MCP-31%20tools-blueviolet?style=flat-square" alt="MCP Tools">
  <img src="https://img.shields.io/badge/Multi--Agent-4--16%20agents-purple?style=flat-square" alt="Multi-Agent">
</p>

---
<!-- end-badges -->

<p align="center">
<pre>
  ╔══════════════════════════════════════════════════════════════╗
  ║    ╱⌒╲                              ╱⌒╠══                    ║
  ║   ( 🦞 )   █▀▀▀ █▄░█ █▀▄▀█ █▀▀▀   ( 🦞 )  LOBSTER          ║
  ║    ╲╱      █░▀█ █░▀█ █░▀░█ ██▀    ╲╱                       ║
  ║           ▀▀▀▀▀ ▀░░▀ ▀░░░▀ ▀▀▀                              ║
  ║    ──────────────────────────────────────────────────────    ║
  ║    ░▄░ █▀▀█ █▀▄▀█ ▀█▀ █▀▀█   █▀▀█ █░░ █▀▀ █░█ █▀▀▄        ║
  ║    ▀▄▀ █░░█ █░▀░█ ░█░ █░░█   █▄▄▀ █░░ █▀▀ ▄▀▄ █░░█        ║
  ║    ▀░▀ ▀▀▀▀ ▀░░░▀ ░▀░ ▀▀▀▀   ▀░▀▀ ▀▀▀ ▀▀▀ ▀░▀ ▀▀▀░        ║
  ║    ──────────────────────────────────────────────────────    ║
  ║    🦞  Solana × xAI  |  Agentic Trading Engine  |  $CLAWD  🦞   ║
  ╚══════════════════════════════════════════════════════════════╝
</pre>
</p>

---
<!-- end-lobster-banner -->

## ⚡ One-Shot Install

```bash
npm install -g @mawdbotsonsolana/nemoclawd

# Start with Grok + Solana tools
nemoclawd launch

# Run demo walkthrough
nemoclawd demo
```

Need Node.js 20+? The bundled [`install.sh`](install.sh) handles everything — Node.js via nvm, optional GPU/Ollama support, and the CLI — in a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/x402agent/nemo-clawd/main/install.sh | bash
```

<!-- start-quickstart-guide -->
### Quick Start

```bash
npm install -g @mawdbotsonsolana/nemoclawd

# Start with Grok + Solana tools
nemoclawd launch

# Run demo walkthrough
nemoclawd demo
```
<!-- end-quickstart-guide -->

---

## solana-clawd Integration

**nemoclawd** now integrates **solana-clawd** — the full xAI Grok-powered agentic framework for Solana trading, research, and autonomous agent operations.

### What You Get

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   xAI Grok Integration ─── 4-16 Grok agents with web + X search    │
│   │                     Chat, vision, image gen, voice            │
│   │                                                               │
│   $CLAWD Token ───────── 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump │
│   │                     Solana + Pump.fun native                  │
│   │                                                               │
│   31 MCP Tools ───────── Solana market data, trading, NFTs        │
│   │                     Helius RPC/DAS, Pump.fun SDK              │
│   │                                                               │
│   Multi-Agent Research ─ 4 or 16 Grok agents collaborating       │
│   │                     Deep Solana research + intelligence       │
│   │                                                               │
│   Blockchain Buddies ─── 18 species with trading personalities    │
│   │                     Procedurally generated companions         │
│   │                                                               │
│   Voice Mode ─────────── xAI Grok text-to-speech agent            │
│   │                     Conversational AI + STT                   │
│   │                                                               │
│   Telegram Bot ───────── 60+ commands for trading + research      │
│                         Real-time alerts, sniping, narration      │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Spinner Packs

nemoclawd ships the bundled Clawd spinner verb packs from `spinners/` and can install them into your local Clawd settings:

```bash
nemoclawd spinners list
nemoclawd spinners install developer
nemoclawd spinners remove
```

The installer writes only the `spinnerVerbs` field in `~/.clawd/settings.json`, falling back to `~/.claude/settings.json` when that file already exists.

### Core AI Bundle

nemoclawd vendors the Clawd Core AI bundle in `core-ai/`: Helius MCP and CLI tooling, Helius skill/plugin packs, Clawd Code, the Bun-native Clawd Grok runtime, the perps agent, a standalone pump MCP server, v3 runtime scaffolding, and the Clawd knowledge base.

```bash
nemoclawd core-ai status
nemoclawd core-ai packages
nemoclawd core-ai package helius-mcp
nemoclawd core-ai commands
```

Build and setup commands are exposed as root npm scripts:

```bash
npm run core-ai:helius-mcp:build
npm run core-ai:helius-cli:build
npm run core-ai:clawd-code:build
npm run core-ai:mcp-server:build
```

Run the Clawd plugin directly with:

```bash
clawd --plugin-dir core-ai/helius-plugin
```

### Jetson Orin Nano

For a single Jetson Orin Nano or Orin Nano Super Developer Kit, use the dedicated Orin path instead of `setup-spark`:

```bash
sudo nemoclawd setup-orin-nano
export NVIDIA_API_KEY="nvapi-..."
nemoclawd onboard
openshell inference set --no-verify --provider nvidia-nim --model nvidia/nemotron-3-ultra-550b-a55b
```

See [docs/deployment/set-up-orin-nano.md](docs/deployment/set-up-orin-nano.md).

### DFlow Spot and Prediction Routing

DFlow is the default Solana-native route for spot trading and prediction markets. Set `DFLOW_API_KEY` for production; without it, nemoclawd uses DFlow developer endpoints.

```bash
export DFLOW_API_KEY="your_dflow_key"
nemoclawd dflow status
```

Spot swaps and prediction outcome-token orders both use DFlow's `/order` trading endpoint. Prediction market discovery uses the DFlow prediction metadata API.

### ZK Primitives

The repository includes `zk-primitives/`, a Solana-native ZK workspace for model attestations, one-shot nullifiers, Groth16 proof preparation, and Light Protocol compressed-state helpers.

```bash
pnpm --dir zk-primitives install --frozen-lockfile
npm run build:zk
npm run test:zk
```

The ZK agent builds instructions and derives proof metadata locally. Signing and transaction submission remain explicit operator actions.

### xAI Grok Setup

```bash
export XAI_API_KEY="your_key"              # One key unlocks everything: chat, voice, vision, search, multi-agent, tools
export XAI_MANAGEMENT_API_KEY="your_key"   # Required for Collections API management
export HELIUS_API_KEY="your_free_key"      # From helius.dev
```

### Grok Models

| Model | What it does | Use case |
|-------|-------------|----------|
| `grok-4.20-reasoning` / `grok-4.3` | Chat, reasoning, vision, structured output, voice | Default for everything |
| `grok-4.20-multi-agent` | 4-16 agents collaborating in real-time | Deep research, complex analysis |
| `grok-4-1-fast` | Quick responses, low latency | Fast queries, real-time UX |
| `grok-imagine-image` / `grok-img-1.0` | Image generation + editing | Memes, avatars, visualizations |
| `grok-voice-latest` | Flagship voice model (grok-voice-think-fast-1.0) | Voice Agent API, streaming TTS |

---

### xAI Voice APIs

nemoclawd integrates all xAI voice capabilities — **Voice Agent API** (realtime speech-to-speech), **Text to Speech** (REST + WebSocket), **Speech to Text** (REST + WebSocket), and **Custom Voices** — all powered by Grok.

#### Voice Agent API (Realtime)

Build real-time, speech-to-speech voice agents over WebSockets with low-latency turn-taking and tool use.

```python
import asyncio, json, os, websockets

async def voice_agent():
    async with websockets.connect(
        "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
        additional_headers={"Authorization": f"Bearer {os.environ['XAI_API_KEY']}"}
    ) as ws:
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "voice": "eve",
                "instructions": "You are a helpful Solana trading assistant.",
                "turn_detection": {"type": "server_vad"},
                "tools": [{"type": "web_search"}]
            }
        }))
        async for msg in ws:
            event = json.loads(msg)
            if event["type"] == "response.output_audio.delta":
                pass  # Play audio: base64.b64decode(event["delta"])

asyncio.run(voice_agent())
```

**Session Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `instructions` | string | System prompt |
| `reasoning.effort` | `"high"` \| `"none"` | Controls reasoning (default: `"high"`). Voice Agent only. |
| `voice` | string | `eve`, `ara`, `rex`, `sal`, `leo` or custom voice ID |
| `turn_detection.type` | string \| null | `"server_vad"` for automatic VAD, `null` for manual |
| `turn_detection.threshold` | number | VAD threshold (0.1–0.9, default: `0.85`) |
| `turn_detection.silence_duration_ms` | number | Silence before ending turn (0–10000ms) |
| `turn_detection.prefix_padding_ms` | number | Audio before detected speech start (default: `333`) |
| `turn_detection.idle_timeout_ms` | number | Proactive re-engagement timeout |
| `resumption.enabled` | boolean | Session resumption (default: `false`) |
| `audio.input.format` | object | Input: `"audio/pcm"`, `"audio/pcmu"`, `"audio/pcma"` |
| `audio.output.format` | object | Output: same types as input |
| `audio.output.speed` | number | Speed multiplier (0.7–1.5, default: `1.0`) |
| `replace` | object | Pronunciation replacements, e.g. `{"Solana": "So-lah-nah"}` |
| `tools` | array | `file_search`, `web_search`, `x_search`, `mcp`, `function` |

**Supported Audio Sample Rates:** 8000, 16000, 22050, **24000** (default), 32000, 44100, 48000 Hz

**Available Voices:**

| Voice | Type | Tone | Description |
|-------|------|------|-------------|
| **`eve`** | Female | Energetic, upbeat | Default — engaging and enthusiastic |
| **`ara`** | Female | Warm, friendly | Balanced and conversational |
| **`rex`** | Male | Confident, clear | Professional and articulate |
| **`sal`** | Neutral | Smooth, balanced | Versatile for various contexts |
| **`leo`** | Male | Authoritative, strong | Commanding, instructional |

**Ephemeral Tokens:** For client-side apps (browsers, mobile), generate short-lived tokens server-side via `POST https://api.x.ai/v1/realtime/client_secrets`:

```bash
curl -X POST https://api.x.ai/v1/realtime/client_secrets \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expires_after": {"seconds": 300}}'
```

Then use in browser: `new WebSocket("wss://api.x.ai/v1/realtime", ["xai-client-secret.{TOKEN}"])`

**Migrating from OpenAI Realtime:** Change base URL to `wss://api.x.ai/v1/realtime?model=grok-voice-latest`, swap API key to `XAI_API_KEY`. The `force_message`, `resumption`, and `replace` features are xAI extensions.

#### Text to Speech (TTS)

Convert text to spoken audio. REST API or WebSocket streaming.

**REST TTS:**

```bash
curl -X POST https://api.x.ai/v1/tts \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to nemoclawd. How can I help you today?",
    "voice_id": "eve",
    "language": "en"
  }' \
  --output welcome.mp3
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | ✓ | Text to speak (max 15,000 chars). Supports speech tags. |
| `voice_id` | | Voice: `eve`, `ara`, `rex`, `sal`, `leo` or custom voice ID (default: `eve`) |
| `language` | ✓ | BCP-47 code (`en`, `zh`, `pt-BR`) or `auto` |
| `output_format` | | Codec + sample_rate + bit_rate. Default: MP3 24kHz/128kbps |
| `speed` | | Speed multiplier (0.7–1.5, default: `1.0`) |
| `with_timestamps` | | Return character-level timestamps (JSON envelope) |
| `optimize_streaming_latency` | | 0, 1, or 2 for latency optimization |
| `text_normalization` | | Normalize numbers/abbreviations to spoken form |

**Output Formats:**

| Codec | Content-Type | Best for |
|-------|-------------|----------|
| `mp3` | `audio/mpeg` | General use, wide compatibility |
| `wav` | `audio/wav` | Lossless, editing |
| `pcm` | `audio/pcm` | Real-time processing |
| `mulaw` | `audio/basic` | Telephony (G.711 μ-law) |
| `alaw` | `audio/alaw` | Telephony (G.711 A-law) |

**Speech Tags:** Add inline tags for expressive delivery — `[laugh]`, `[pause]`, `[sigh]`, `[breath]`, `[whisper]`, `<soft>`, `<loud>`, `<sing-song>`, `<emphasis>`, etc.

**Streaming TTS (WebSocket):** `wss://api.x.ai/v1/tts?language=en&voice=eve&codec=mp3`

```javascript
// Client → Server
ws.send(JSON.stringify({ type: "text.delta", delta: "Here is some text. " }));
ws.send(JSON.stringify({ type: "text.done" }));
// Server → Client
// { "type": "audio.delta", "delta": "<base64>" }
// { "type": "audio.done", "trace_id": "uuid" }
// Cancel with: { "type": "text.clear" } → { "type": "audio.clear" }
```

#### Speech to Text (STT)

Transcribe audio in a single call (12 formats, 500MB max) or stream over WebSocket.

**REST STT:**

```bash
curl -X POST https://api.x.ai/v1/stt \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -F format=true \
  -F language=en \
  -F "keyterm=nemoclawd" \
  -F file=@meeting.mp3
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | file | Audio file (max 500MB). Must be last field in multipart. |
| `url` | string | URL to download and transcribe |
| `audio_format` | string | Format hint for raw: `pcm`, `mulaw`, `alaw` |
| `sample_rate` | int | Required for raw audio only |
| `language` | string | Language code for text formatting |
| `format` | boolean | Inverse Text Normalization (e.g. "one hundred" → "$100") |
| `multichannel` | boolean | Transcribe each channel independently |
| `channels` | int | 2–8 channels |
| `diarize` | boolean | Speaker diarization |
| `keyterm` | string | Bias transcription toward key terms (repeat for multiple) |
| `filler_words` | boolean | Include "uh", "um" in transcript |

**Streaming STT (WebSocket):** `wss://api.x.ai/v1/stt?sample_rate=16000&encoding=pcm&interim_results=true`

```javascript
// Send raw PCM16 audio as binary frames
ws.send(audioChunk);  // 100ms chunks (3200 bytes at 16kHz)
ws.send(JSON.stringify({ type: "audio.done" }));

// Receive transcripts
// { "type": "transcript.partial", "text": "...", "is_final": false }
// { "type": "transcript.done", "text": "...", "duration": 12.5 }
```

**Smart Turn:** Enable `smart_turn=0.7` for ML-based end-of-turn detection. Prevents false endpointing on mid-sentence pauses.

**Supported Formats:** WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV, PCM, μ-law, A-law

**Streaming Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sample_rate` | 16000 | Audio sample rate |
| `encoding` | `pcm` | `pcm`, `mulaw`, or `alaw` |
| `interim_results` | false | Emit partial transcripts every ~500ms |
| `smart_turn` | | End-of-turn ML confidence (0.0–1.0) |
| `smart_turn_timeout` | | Max silence before forcing speech_final (ms) |
| `diarize` | false | Speaker identification |
| `multichannel` | false | Per-channel transcription |
| `keyterm` | | Bias transcription (max 100 terms) |

#### Custom Voices

Clone any voice from a 120s reference clip, then use the resulting `voice_id` anywhere a built-in voice works (TTS, Voice Agent API, streaming TTS).

```bash
# Create a custom voice
curl -X POST https://api.x.ai/v1/custom-voices \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -F "name=Friendly Narrator" \
  -F "language=en" \
  -F "file=@reference.wav;type=audio/wav"

# Response: { "voice_id": "nlbqfwie", ... }

# Use it for TTS
curl -X POST https://api.x.ai/v1/tts \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!", "voice_id": "nlbqfwie", "language": "en"}' \
  --output custom.mp3
```

**Endpoints:** `GET /v1/custom-voices`, `GET /v1/custom-voices/{id}`, `PATCH /v1/custom-voices/{id}`, `DELETE /v1/custom-voices/{id}`, `GET /v1/custom-voices/{id}/audio`

**Limits:** Up to 30 custom voices per team, reference audio max 120s, 8-char alphanumeric voice IDs.

**Recording Tips:** Record in quiet room with quality mic, 90–120s recommended, match recording style to intended use case (conversational, narration, support, etc.).

---

### xAI Tools

The xAI API supports both built-in tools (server-side, auto-executed) and custom function calling.

#### Function Calling

Define custom tools with JSON Schema parameters:

```javascript
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });

const response = await client.responses.create({
  model: "grok-4.3",
  input: [{ role: "user", content: "What's the weather in San Francisco?" }],
  tools: [{
    type: "function",
    name: "get_temperature",
    description: "Get current temperature for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
        unit: { type: "string", enum: ["celsius", "fahrenheit"] }
      },
      required: ["location"]
    }
  }]
});
```

- **Tool Choice:** `"auto"` (default), `"required"`, `"none"`, or force specific tool
- **Parallel calling:** Enabled by default. Disable with `parallel_tool_calls: false`
- **Max tools:** 200 per request

#### Built-in Tools

| Tool | xAI SDK | OpenAI Responses API | Description |
|------|---------|---------------------|-------------|
| **Web Search** | `web_search()` | `web_search` | Real-time web search + page browsing |
| **X Search** | `x_search()` | `x_search` | Search X posts, users, threads |
| **Code Execution** | `code_execution()` | `code_interpreter` | Run Python in sandbox (NumPy, Pandas, Matplotlib) |
| **Collections Search** | `collections_search()` | `file_search` | Search uploaded document collections |
| **Remote MCP** | `mcp()` | `mcp` | Connect to external MCP servers |

**Web Search Parameters:** `allowed_domains` (max 5), `excluded_domains` (max 5), `enable_image_understanding`, `enable_image_search`

**X Search Parameters:** `allowed_x_handles` (max 20), `excluded_x_handles` (max 20), `from_date`, `to_date`, `enable_image_understanding`, `enable_video_understanding`

**Remote MCP Tools:**

```python
from xai_sdk.tools import mcp

tools = [
    mcp(server_url="https://mcp.deepwiki.com/mcp", server_label="deepwiki"),
    mcp(server_url="https://your-tools.com/mcp", server_label="custom",
        allowed_tool_names=["search_db", "format_data"],
        authorization="Bearer your-token"),
]
```

Parameters: `server_url` (required, SSE/Streaming HTTP), `server_label` (required), `allowed_tool_names`, `authorization`, `extra_headers`. Multi-server supported.

#### Collections Search (RAG)

Search uploaded document collections for RAG-powered responses:

```python
from xai_sdk.tools import collections_search, code_execution, web_search

chat = client.chat.create(
    model="grok-4.3",
    tools=[
        collections_search(collection_ids=["your-collection-id"]),
        code_execution(),
        web_search(),  # Combine with web search for hybrid analysis
    ],
)
```

Citations use `collections://collection_id/files/file_id` URIs.

---

### Advanced xAI API Features

#### Prompt Caching

Reduce costs by caching prompt prefixes. Use `x-grok-conv-id` header (Chat Completions) or `prompt_cache_key` field (Responses API):

```bash
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "x-grok-conv-id: conv_abc123" \
  -d '{
    "model": "grok-4.3",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is prompt caching?"}
    ]
  }'
```

Check `response.usage.prompt_tokens_details.cached_tokens` or `response.usage.input_tokens_details.cached_tokens` to confirm cache hits.

#### Priority Processing

Get lower latency by adding `service_tier: "priority"` to any Chat Completions or Responses request. Billed at a premium rate. Check `response.service_tier` to confirm:

```bash
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4.3",
    "input": "Explain the Riemann hypothesis.",
    "service_tier": "priority"
  }'
```

#### Context Compaction

Shrink long conversations into a single opaque compaction item to reduce input cost and latency:

```bash
# Step 1: Compact
curl -X POST https://api.x.ai/v1/responses/compact \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4.3",
    "input": [
      {"role": "system", "content": "You are a science tutor."},
      {"role": "user", "content": "What is the Higgs boson?"},
      {"role": "assistant", "content": "..."},
      # ... many more turns ...
    ]
  }'

# Step 2: Continue with compaction output
curl -X POST https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-4.3",
    "input": [
      {"type": "compaction", "id": "cmp_abc123", "encrypted_content": "<opaque blob>"},
      {"role": "user", "content": "Continue our discussion..."}
    ]
  }'
```

The xAI SDK also supports in-place compaction: `chat.compact()` replaces the chat's message list with the compaction item. Use `use_encrypted_content=True` on chat creation to preserve reasoning content across compactions.

#### mTLS Authentication

Enterprise-grade certificate-based authentication. Point to `https://mtls.api.x.ai` and attach your client certificate:

```bash
curl https://mtls.api.x.ai/v1/chat/completions \
  --cert /path/to/client-cert.pem \
  --key /path/to/client-key.pem \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{"model": "grok-4.3", "messages": [{"role": "user", "content": "Hello"}]}'
```

Contact [support@x.ai](mailto:support@x.ai) with your team ID and CA certificate to enable.

---

### MCP Tools (31)

**Solana Market Data:**
- `solana_price`, `solana_trending`, `solana_token_info`, `solana_wallet_pnl`
- `solana_search`, `solana_top_traders`, `solana_wallet_tokens`, `sol_price`

**Helius Onchain:**
- `helius_account_info`, `helius_balance`, `helius_transactions`
- `helius_priority_fee`, `helius_das_asset`, `helius_webhook_create`

**Agent Fleet:**
- `agent_spawn`, `agent_list`, `agent_stop`

**Memory:**
- `memory_recall`, `memory_write`

**Metaplex:**
- `metaplex_mint_agent`, `metaplex_register_identity`, `metaplex_read_agent`

**Pump.fun:**
- `pump_token_scan`, `pump_buy_quote`, `pump_sell_quote`, `pump_graduation`

---

## OODA Trading Loop

```
OBSERVE  → sol_price, trending, helius_priority_fee, memory KNOWN
ORIENT   → score candidates (trend + momentum + liquidity + participation)
DECIDE   → confidence ≥ 60? → size band (0.5x / 1.0x / 1.25x / 1.5x)
ACT      → trade_execute gated at `ask` permission (human approval required)
LEARN    → write INFERRED signals → Dream agent promotes to LEARNED
```

### Agent Fleet

| Agent | Type | Description |
|-------|------|-------------|
| **$CLAWD** | `Clawd` | Full autonomous agent — chat, vision, image gen, multi-agent, voice |
| **Grok Researcher** | `GrokResearcher` | 16-agent deep research with web + X search |
| **Explorer** | `Explore` | Read-only Solana research (fast, cheap) |
| **Scanner** | `Scanner` | Trend monitoring, surfaces high-signal opportunities |
| **OODA** | `OODA` | Full trading cycle: Observe, Orient, Decide, Act, Learn |
| **Dream** | `Dream` | Memory consolidation (INFERRED to LEARNED promotion) |
| **Analyst** | `Analyst` | Deep structured research reports |
| **Monitor** | `Monitor` | Helius WebSocket event listeners |

---

## Blockchain Buddies

Every `nemoclawd` user gets a companion — a procedurally generated Blockchain Buddy with its own wallet, trading personality, stats, and animated ASCII sprite.

```bash
nemoclawd birth   # hatch yours now
```

### Species (18 total)

| Category | Species | Personality | Risk Level |
|---|---|---|---|
| **Solana Natives** | SolDog, BONK Dog, dogwifhat, Jupiter Agg, Raydium LP | Diamond Hands / Degen / Bot | Low → Degen |
| **DeFi Archetypes** | Whale, Bull, Bear, MEV Shark, Octopus | Whale / Sniper / Ninja | Low → Medium |
| **Memecoin Culture** | Pepe, Pump.fun, Sniper Bot | Degen / Sniper | High → Degen |

---

## Telegram Trading Bot

### Commands

| Command | Response |
|---|---|
| `/sol` | SOL price (CoinGecko) |
| `/price <mint\|symbol>` | Token price |
| `/trending` | Top 10 trending tokens |
| `/wallet <address>` | Wallet PnL analysis |
| `/scan` | Toggle background pump scanner |
| `/snipe [config]` | Start sniper bot |
| `/grok <question>` | Chat with Grok |
| `/xsearch <query>` | Search X/Twitter live |
| `/imagine <prompt>` | Generate images |

---

## Deploy to Fly.io

```bash
cd MCP
fly launch --config fly.toml
fly secrets set HELIUS_API_KEY=your-key XAI_API_KEY=your-key MCP_API_KEY=optional-bearer-token
```

Then connect via:
```json
{ "type": "http", "url": "https://your-app.fly.dev/mcp" }
```

---

## Architecture

```
                     ┌─────────────────────────────────────────────────────┐
                     │                  ENTRY POINTS                       │
                     │  nemoclawd CLI    MCP Server    Telegram Bot        │
                     │  (interactive/   (stdio/HTTP)   60+ commands       │
                     │   one-shot)                                        │
                     └────────┬──────────┬────────────────┬────────────────┘
                              │          │                │
                              ▼          ▼                ▼
                     ┌─────────────────────────────────────────────────────┐
                     │                  CORE ENGINE                        │
                     │  QueryEngine ──► xAI Grok ──► Tool Execution       │
                     │    │              │              │               │
                     │    │  Providers:   │   ┌──────────┤               │
                     │    │  - xAI/Grok   │   │          │               │
                     │    │  - OpenRouter │   ▼          ▼               │
                     │    │  - Anthropic  │  ToolExecutor  Permission     │
                     └─────┼──────────────┼──────────────────────────────┘
                           │              │
               ┌───────────┴──────────────┴──────────────────────────────┐
               │                              │                         │
               ▼                              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────┐  ┌────────────────┐
│     SUPPORT LAYER    │  │      MEMORY SYSTEM       │  │   DATA SOURCES │
│                      │  │                          │  │                │
│  AppState (Zustand)  │  │  KNOWN   (ephemeral,     │  │  Helius RPC    │
│  - PermissionMode    │  │           ~60s TTL)      │  │  Helius DAS    │
│  - OODA phase        │  │                          │  │  Pump.fun      │
│  - PumpSignals       │  │  LEARNED (persistent,    │  │  Jupiter       │
│                      │  │           cross-session)  │  │                │
│  Risk Engine         │  │                          │  │  Solana Tracker│
└──────────────────────┘  │  INFERRED (tentative,    │  │                │
                           │           markdown)       │  │                │
                           └──────────────────────────┘  └────────────────┘
```

---

## Environment Variables

```bash
# Core (free at helius.dev)
HELIUS_API_KEY=               # RPC, DAS, enhanced txs, webhooks
HELIUS_RPC_URL=               # Helius mainnet RPC

# xAI Grok (one key unlocks everything)
XAI_API_KEY=                  # Grok: chat, voice, vision, search, multi-agent, tools
XAI_MANAGEMENT_API_KEY=       # Required for Collections API management

# OpenRouter (optional)
OPENROUTER_API_KEY=           # Multi-model LLM routing

# ZK primitives (optional)
ZK_SHARK_RPC_URL=             # RPC for ZK instruction construction
CLAWD_ZK_RPC_URL=             # Legacy alias accepted by zk-primitives

# Telegram
TELEGRAM_BOT_TOKEN=           # From @BotFather

# Wallet (optional)
SOLANA_PRIVATE_KEY=           # Base58 keypair for live trades
SOLANA_PUBLIC_KEY=           # Default wallet
```

---

## License

Licensed under [Apache 2.0](LICENSE).

**$CLAWD** `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`

Powered by **xAI Grok** from **xAI** | Built on **Solana**