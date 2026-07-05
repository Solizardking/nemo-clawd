// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * 🪄 NEMOCLAWD MAGIC ROUTER
 *
 * The brain of the operation. Takes any natural-language task, classifies it,
 * assigns a confidence score, and routes it to the optimal inference model +
 * tool set. All in ~500 lines. Yes, it's that cool.
 *
 * Classification flow:
 *   Input → regex pattern match → confidence score → task type
 *   Task type → tool set mapping → guardrails → DFlow routing
 *   Inference → Ollama (default) → OpenRouter (advisor) → NVIDIA (fallback)
 */
import { getAgentMode, partitionToolsForMode, type AgentMode } from "./agent-mode.js";

export const MAGIC_ROUTER_STRATEGY = "magic-router";
export const MAGIC_ROUTER_VERSION = "2.0.0";

// ── Inference providers ──────────────────────────────────────────────
export const OLLAMA_DEFAULT_PROVIDER = "ollama-local";
export const OLLAMA_DEFAULT_MODEL = "hf.co/ordlibrary/hauhau-qwen36-onchain";
export const OPENROUTER_PROVIDER = "openrouter";
export const OPENROUTER_AUTO_MODEL = "openrouter/auto";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const NVIDIA_FALLBACK_PROVIDER = "nvidia-nim";
export const NVIDIA_FALLBACK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

type EnvLike = Record<string, string | undefined>;

// ── Task types ───────────────────────────────────────────────────────
export type MagicRouterTaskType =
  | "coding"
  | "zk_proof"
  | "solana_trading"
  | "prediction_market"
  | "wallet_ops"
  | "research"
  | "image_gen"
  | "voice"
  | "data_analysis"
  | "security_audit"
  | "nft_ops"
  | "general";

// ── Task metadata for runtime classification ─────────────────────────
export interface MagicRouterTaskMetadata {
  type: MagicRouterTaskType;
  label: string;
  emoji: string;
  description: string;
  confidence: number;           // 0.0 – 1.0
  requires_wallet: boolean;
  requires_api_key: boolean;
  typical_latency: "fast" | "medium" | "slow";
}

// ── Inference route ──────────────────────────────────────────────────
export interface MagicRouterInferenceRoute {
  provider: string;
  model: string;
  credentialEnv: string;
  available: boolean;
  role: "selected" | "advisor" | "fallback";
  endpoint?: string;
  reason: string;
}

// ── Full route decision ──────────────────────────────────────────────
export interface MagicRouterRoute {
  strategy: typeof MAGIC_ROUTER_STRATEGY;
  version: typeof MAGIC_ROUTER_VERSION;
  mode: AgentMode;
  taskType: MagicRouterTaskType;
  taskMeta: MagicRouterTaskMetadata;
  inference: MagicRouterInferenceRoute;
  advisor?: MagicRouterInferenceRoute;
  fallbacks: MagicRouterInferenceRoute[];
  toolSet: string[];
  blockedTools: string[];
  guardrails: string[];
  dflow: {
    spotTradingDefault: boolean;
    predictionMarketDefault: boolean;
    credentialEnv: "DFLOW_API_KEY";
  };
}

// ── Helpers ──────────────────────────────────────────────────────────
function hasEnv(env: EnvLike, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function textFromInput(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input.join(" ");
  return input || "";
}

// ── Task metadata catalog ────────────────────────────────────────────
const TASK_METADATA: Record<MagicRouterTaskType, Omit<MagicRouterTaskMetadata, "type" | "confidence">> = {
  coding: {
    label: "Software Engineering",
    emoji: "💻",
    description: "Code generation, debugging, testing, refactoring, repo analysis",
    requires_wallet: false,
    requires_api_key: false,
    typical_latency: "fast",
  },
  zk_proof: {
    label: "Zero-Knowledge Proofs",
    emoji: "🔐",
    description: "Groth16 proofs, nullifiers, attestations, compressed state, Light Protocol",
    requires_wallet: true,
    requires_api_key: false,
    typical_latency: "slow",
  },
  solana_trading: {
    label: "Solana Trading",
    emoji: "📈",
    description: "Spot swaps, DFlow routing, Jupiter quotes, slippage analysis, token swaps",
    requires_wallet: true,
    requires_api_key: false,
    typical_latency: "fast",
  },
  prediction_market: {
    label: "Prediction Markets",
    emoji: "🎯",
    description: "Kalshi outcome tokens, YES/NO positions, market odds, Proof KYC",
    requires_wallet: true,
    requires_api_key: false,
    typical_latency: "medium",
  },
  wallet_ops: {
    label: "Wallet Operations",
    emoji: "👛",
    description: "Balance checks, transfers, keypair management, signing, air drops",
    requires_wallet: true,
    requires_api_key: false,
    typical_latency: "fast",
  },
  research: {
    label: "Research & Intelligence",
    emoji: "🔬",
    description: "Web search, docs analysis, benchmark comparison, market intel",
    requires_wallet: false,
    requires_api_key: false,
    typical_latency: "medium",
  },
  image_gen: {
    label: "Image Generation",
    emoji: "🎨",
    description: "Meme generation, NFT artwork, visualizations, avatar creation",
    requires_wallet: false,
    requires_api_key: true,
    typical_latency: "slow",
  },
  voice: {
    label: "Voice & Speech",
    emoji: "🎙️",
    description: "Text-to-speech, speech-to-text, voice agent, custom voice cloning",
    requires_wallet: false,
    requires_api_key: true,
    typical_latency: "medium",
  },
  data_analysis: {
    label: "Data Analysis",
    emoji: "📊",
    description: "On-chain analytics, wallet PnL, token metrics, trend detection, portfolio tracking",
    requires_wallet: false,
    requires_api_key: false,
    typical_latency: "medium",
  },
  security_audit: {
    label: "Security Audit",
    emoji: "🛡️",
    description: "Smart contract review, rug detection, token verification, permission analysis",
    requires_wallet: false,
    requires_api_key: false,
    typical_latency: "slow",
  },
  nft_ops: {
    label: "NFT Operations",
    emoji: "🖼️",
    description: "Mint, list, buy, sell, metadata lookup, collection analysis, rarity scoring",
    requires_wallet: true,
    requires_api_key: false,
    typical_latency: "medium",
  },
  general: {
    label: "General Purpose",
    emoji: "🧠",
    description: "Chat, Q&A, brainstorming, creative writing, anything else",
    requires_wallet: false,
    requires_api_key: false,
    typical_latency: "fast",
  },
};

// ── Classification with confidence scoring ───────────────────────────
const CLASSIFIERS: Array<{ type: MagicRouterTaskType; patterns: RegExp[]; weight: number }> = [
  {
    type: "nft_ops",
    patterns: [
      /\b(nft|collection|rarity|metadata|token uri|mint.*nft|nft.*mint|nft.*buy|nft.*sell|nft.*list)\b/i,
      /\b(candy machine|metaplex|nft.*price|floor price|nft.*hold|nft.*transfer)\b/i,
    ],
    weight: 0.92,
  },
  {
    type: "prediction_market",
    patterns: [
      /\b(prediction|kalshi|outcome token|yes token|no token|market odds|kyc|probability|bet on|resolve market)\b/i,
      /\b(buy yes|buy no|sell yes|sell no)\b/i,
    ],
    weight: 0.95,
  },
  {
    type: "zk_proof",
    patterns: [
      /\b(zk|zero[- ]knowledge|groth16|nullifier|attest|attestation|publish_attestation)\b/i,
      /\b(commit_encrypted_state|encrypted state|ciphertext commitment)\b/i,
      /\b(validity proof|compressed state|light protocol|proof|prove|verify proof)\b/i,
    ],
    weight: 0.93,
  },
  {
    type: "solana_trading",
    patterns: [
      /\b(swap|trade|route|quote|slippage|jupiter|dflow|sol\/usdc|usdc)\b/i,
      /\b(token swap|limit order|market order|swap tokens|bridge|buy token|sell token)\b/i,
    ],
    weight: 0.90,
  },
  {
    type: "wallet_ops",
    patterns: [
      /\b(wallet|sign|signature|keypair|balance|airdrop|transfer|send sol)\b/i,
      /\b(private wallet|create wallet|import wallet|export key|my address)\b/i,
    ],
    weight: 0.92,
  },
  {
    type: "coding",
    patterns: [
      /\b(code|build|test|debug|typescript|python|repo|script|compile|install|deploy)\b/i,
      /\b(program|function|api|endpoint|refactor|commit|push|pr|merge|branch)\b/i,
    ],
    weight: 0.88,
  },
  {
    type: "research",
    patterns: [
      /\b(research|search|docs|summarize|latest|compare|benchmark|analyze|what is|explain)\b/i,
      /\b(trending|top|best|newest|upcoming|price of|what's new|news about)\b/i,
    ],
    weight: 0.85,
  },
  {
    type: "image_gen",
    patterns: [
      /\b(image|generate|picture|photo|draw|create.*image|meme.*generate|nft.*art)\b/i,
      /\b(visualize|illustration|artwork|avatar|logo|banner|thumbnail)\b/i,
    ],
    weight: 0.90,
  },
  {
    type: "voice",
    patterns: [
      /\b(voice|speech|speak|say|tts|stt|transcribe|listen|audio|talk|pronounce)\b/i,
      /\b(text to speech|speech to text|voice agent|voice clone|narrate)\b/i,
    ],
    weight: 0.91,
  },
  {
    type: "data_analysis",
    patterns: [
      /\b(analy|metrics|statistics|chart|graph|trend|pnl|portfolio|overview|report)\b/i,
      /\b(token metrics|wallet analysis|profit loss|gain|loss|roi|volume|liquidity)\b/i,
    ],
    weight: 0.87,
  },
  {
    type: "security_audit",
    patterns: [
      /\b(audit|security|vulnerability|exploit|hack|rug|scam|malicious|backdoor)\b/i,
      /\b(smart contract review|token check|verify.*contract|is.*safe|risk.*assess)\b/i,
    ],
    weight: 0.89,
  },
];

/**
 * Classify a task with a confidence score.
 * Returns the best match. If no patterns hit, falls back to "general" with low confidence.
 */
export function classifyMagicRouterTask(input: string | string[] | undefined): MagicRouterTaskType {
  return classifyMagicRouterTaskWithConfidence(input).type;
}

export function classifyMagicRouterTaskWithConfidence(
  input: string | string[] | undefined,
): { type: MagicRouterTaskType; confidence: number } {
  const text = textFromInput(input);

  if (!text.trim()) {
    return { type: "general", confidence: 0.5 };
  }

  let bestType: MagicRouterTaskType = "general";
  let bestScore = 0;

  for (const classifier of CLASSIFIERS) {
    let score = 0;
    for (const pattern of classifier.patterns) {
      if (pattern.test(text)) {
        score += classifier.weight;
      }
    }
    // Bonus for multiple pattern matches in same category
    if (score > 0) {
      const matchCount = classifier.patterns.filter((p) => p.test(text)).length;
      score = Math.min(score + (matchCount - 1) * 0.05, 1.0);
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = classifier.type;
    }
  }

  // General catch-all gets a base confidence
  if (bestScore === 0) {
    return { type: "general", confidence: 0.6 };
  }

  return { type: bestType, confidence: Math.round(bestScore * 100) / 100 };
}

// ── Tool set mapping ─────────────────────────────────────────────────
function toolSetForTask(taskType: MagicRouterTaskType, openRouterAvailable: boolean): string[] {
  const openRouterTool = openRouterAvailable ? ["openrouter-auto-router"] : [];
  switch (taskType) {
    case "zk_proof":
      return ["clawd-zk-agent", "clawd-zk-client", "light-protocol", "solana-rpc", "instruction-builder", "wallet-approval", ...openRouterTool];
    case "prediction_market":
      return ["dflow-prediction-metadata", "dflow-order", "proof-kyc-check", "solana-rpc", "wallet-approval", ...openRouterTool];
    case "solana_trading":
      return ["dflow-order", "dflow-book-stream", "solana-rpc", "wallet-approval", "jupiter-quote", ...openRouterTool];
    case "wallet_ops":
      return ["openshell-private-wallet", "solana-rpc", "wallet-approval", "keypair-gen"];
    case "coding":
      return ["filesystem", "shell", "git", "test-runner", "npm-registry", ...openRouterTool];
    case "research":
      return ["docs-fetch", "web-search", "x-search", "birdeye-api", ...openRouterTool];
    case "image_gen":
      return ["grok-imagine", "openai-image", ...openRouterTool];
    case "voice":
      return ["xai-tts", "xai-stt", "voice-agent-websocket", ...openRouterTool];
    case "data_analysis":
      return ["solana-rpc", "helius-enhanced-tx", "birdeye-api", "wallet-pnl", "token-metrics", ...openRouterTool];
    case "security_audit":
      return ["solana-rpc", "helius-das", "token-verify", "contract-read", "rug-detection", ...openRouterTool];
    case "nft_ops":
      return ["helius-das", "metaplex-read", "nft-mint", "magic-eden-api", "tensor-api", ...openRouterTool];
    case "general":
    default:
      return ["chat", "web-search", ...openRouterTool];
  }
}

// ── Inference route builder ──────────────────────────────────────────
function buildInferenceRoutes(env: EnvLike): { selected: MagicRouterInferenceRoute; advisor?: MagicRouterInferenceRoute; fallbacks: MagicRouterInferenceRoute[] } {
  const ollama: MagicRouterInferenceRoute = {
    provider: OLLAMA_DEFAULT_PROVIDER,
    model: env.OLLAMA_MODEL?.trim() || OLLAMA_DEFAULT_MODEL,
    credentialEnv: "OLLAMA_HOST",
    available: true,
    role: "selected",
    reason: "Default Ollama inference route — hf.co/ordlibrary/hauhau-qwen36-onchain runs locally.",
  };

  const openrouter: MagicRouterInferenceRoute = {
    provider: OPENROUTER_PROVIDER,
    model: env.OPENROUTER_MODEL?.trim() || OPENROUTER_AUTO_MODEL,
    credentialEnv: "OPENROUTER_API_KEY",
    available: hasEnv(env, "OPENROUTER_API_KEY"),
    role: "advisor",
    endpoint: OPENROUTER_API_URL,
    reason: "OpenRouter Auto Router can select the best model for the prompt when enabled.",
  };

  const nvidia: MagicRouterInferenceRoute = {
    provider: NVIDIA_FALLBACK_PROVIDER,
    model: env.NEMOCLAWD_NVIDIA_MODEL?.trim() || env.NVIDIA_MODEL?.trim() || NVIDIA_FALLBACK_MODEL,
    credentialEnv: "NVIDIA_API_KEY",
    available: hasEnv(env, "NVIDIA_API_KEY"),
    role: "fallback",
    reason: "NVIDIA NIM fallback for NVIDIA-hosted inference.",
  };

  return {
    selected: ollama,
    advisor: openrouter.available ? openrouter : undefined,
    fallbacks: [openrouter, nvidia],
  };
}

// ── Full route resolution ────────────────────────────────────────────
export function resolveMagicRouter(
  input: string | string[] | undefined,
  env: EnvLike = process.env,
  mode: AgentMode = getAgentMode(env),
): MagicRouterRoute {
  const { type: taskType, confidence } = classifyMagicRouterTaskWithConfidence(input);
  const routes = buildInferenceRoutes(env);
  const openRouterAvailable = routes.selected.provider === OPENROUTER_PROVIDER || routes.advisor?.provider === OPENROUTER_PROVIDER;
  const taskMeta: MagicRouterTaskMetadata = {
    type: taskType,
    ...TASK_METADATA[taskType],
    confidence,
  };
  const rawToolSet = toolSetForTask(taskType, Boolean(openRouterAvailable));
  const { allowed: toolSet, blocked: blockedTools } = partitionToolsForMode(rawToolSet, mode);
  const aiMode = mode === "ai";

  const guardrails = [
    "least-privilege-tools",
    "read-only-before-signing",
    "explicit-approval-before-wallet-actions",
    "no-private-key-or-seed-phrase-handling",
  ];
  if (aiMode) guardrails.push("ai-mode-financial-tools-disabled");

  return {
    strategy: MAGIC_ROUTER_STRATEGY,
    version: MAGIC_ROUTER_VERSION,
    mode,
    taskType,
    taskMeta,
    inference: routes.selected,
    advisor: routes.advisor,
    fallbacks: routes.fallbacks,
    toolSet,
    blockedTools,
    guardrails,
    dflow: {
      spotTradingDefault: !aiMode,
      predictionMarketDefault: !aiMode,
      credentialEnv: "DFLOW_API_KEY",
    },
  };
}

// ── Pretty-print — the signature feature ─────────────────────────────
export function describeMagicRouter(route: MagicRouterRoute): string {
  const advisor = route.advisor ? `; advisor ${route.advisor.provider}/${route.advisor.model}` : "";
  const blocked = route.blockedTools.length ? `; blocked=${route.blockedTools.join(",")}` : "";
  return `${route.strategy} v${route.version}[${route.mode}]: ${route.taskType} -> ${route.inference.provider}/${route.inference.model}${advisor}; tools=${route.toolSet.join(",")}${blocked}`;
}

export function describeMagicRouterPretty(route: MagicRouterRoute): string {
  const meta = route.taskMeta;
  const lines: string[] = [];

  lines.push(`  🪄  Magic Router v${route.version} — Decision Trace`);
  lines.push(`  ${"─".repeat(48)}`);
  lines.push(``);
  lines.push(`  Mode: ${route.mode}`);
  lines.push(``);
  lines.push(`  ${meta.emoji}  Task Classification`);
  lines.push(`     Input type:    ${meta.label}`);
  lines.push(`     Confidence:    ${(meta.confidence * 100).toFixed(0)}%`);
  lines.push(`     Description:   ${meta.description}`);
  lines.push(``);

  // Latency indicator
  const latencyEmoji = meta.typical_latency === "fast" ? "⚡" : meta.typical_latency === "medium" ? "⏳" : "🐢";
  lines.push(`  ${latencyEmoji}  Performance Profile`);
  lines.push(`     Latency:       ${meta.typical_latency}`);
  lines.push(`     Requires key:  ${meta.requires_api_key ? "yes" : "no"}`);
  lines.push(`     Needs wallet:  ${meta.requires_wallet ? "yes" : "no"}`);
  lines.push(``);

  // Inference route
  const inference = route.inference;
  const providerCheck = inference.available ? "✅" : "❌";
  lines.push(`  🧠  Inference Route`);
  lines.push(`     Primary:       ${providerCheck} ${inference.provider} / ${inference.model}`);
  lines.push(`     Credential:    $${inference.credentialEnv}`);
  lines.push(`     Reason:        ${inference.reason}`);

  if (route.advisor) {
    const adv = route.advisor;
    const advCheck = adv.available ? "✅" : "❌";
    lines.push(`     Advisor:       ${advCheck} ${adv.provider} / ${adv.model}`);
  }

  for (const fb of route.fallbacks) {
    const fbCheck = fb.available ? "✅" : "❌";
    lines.push(`     Fallback:      ${fbCheck} ${fb.provider} / ${fb.model}`);
  }
  lines.push(``);

  // Tool set
  lines.push(`  🛠️  Tool Set (${route.toolSet.length})`);
  for (const tool of route.toolSet) {
    lines.push(`     • ${tool}`);
  }
  if (route.blockedTools.length) {
    lines.push(``);
    lines.push(`  🚫  Blocked by AI Mode (${route.blockedTools.length})`);
    for (const tool of route.blockedTools) {
      lines.push(`     • ${tool}`);
    }
  }
  lines.push(``);

  // Guardrails
  lines.push(`  🛡️  Guardrails`);
  for (const g of route.guardrails) {
    lines.push(`     ✓ ${g}`);
  }
  lines.push(``);

  // DFlow
  lines.push(`  🔀  DFlow Routing`);
  lines.push(`     Spot trading:           ${route.dflow.spotTradingDefault ? "✅ enabled" : "❌ disabled"}`);
  lines.push(`     Prediction markets:     ${route.dflow.predictionMarketDefault ? "✅ enabled" : "❌ disabled"}`);
  lines.push(`     Credential:             $${route.dflow.credentialEnv}`);

  return lines.join("\n");
}

/**
 * Get the full task metadata catalog — useful for docs / help output.
 */
export function getTaskCatalog(): Array<{ type: MagicRouterTaskType } & Omit<MagicRouterTaskMetadata, "type" | "confidence">> {
  return (Object.entries(TASK_METADATA) as [MagicRouterTaskType, Omit<MagicRouterTaskMetadata, "type" | "confidence">][]).map(
    ([type, meta]) => ({
      type,
      ...meta,
    }),
  );
}