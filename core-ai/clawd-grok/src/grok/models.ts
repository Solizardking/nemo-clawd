/**
 * xAI Grok model definitions and metadata.
 */

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  inputPrice: number; // per 1M tokens
  outputPrice: number; // per 1M tokens
  reasoning?: boolean;
  multiAgent?: boolean;
  responsesOnly?: boolean;
  supportsClientTools?: boolean;
  supportsMaxOutputTokens?: boolean;
  reasoningEfforts?: string[];
  aliases?: string[];
}

export const DEFAULT_MODEL = "grok-4.3";

export const MODELS: ModelDefinition[] = [
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    description: "xAI flagship reasoning model — best for agent tasks, code, and market analysis",
    contextWindow: 256_000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    reasoning: true,
    supportsClientTools: true,
    aliases: ["grok-4-1-fast", "xai/grok-code-fast-1"],
  },
  {
    id: "grok-4.20-non-reasoning",
    name: "Grok 4.20 (Non-reasoning)",
    description: "Fast, cost-effective Grok model without extended reasoning — good for quick tasks",
    contextWindow: 256_000,
    inputPrice: 2.0,
    outputPrice: 10.0,
    supportsClientTools: true,
    aliases: ["grok-4.20-0309-non-reasoning", "x-ai/grok-3"],
  },
  {
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 Multi-Agent",
    description: "Specialized Grok model for multi-agent orchestration — responses API only",
    contextWindow: 256_000,
    inputPrice: 2.0,
    outputPrice: 10.0,
    multiAgent: true,
    responsesOnly: true,
    supportsClientTools: false,
    aliases: ["grok-4.20-multi-agent", "x-ai/grok-4.20-multi-agent-beta"],
  },
  {
    id: "grok-4.20-0309-reasoning",
    name: "Grok 4.20 Reasoning",
    description: "Grok model with extended chain-of-thought reasoning for complex problems",
    contextWindow: 256_000,
    inputPrice: 3.0,
    outputPrice: 15.0,
    reasoning: true,
    supportsClientTools: true,
    aliases: ["grok-4.20-reasoning"],
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    description: "Small, fast Grok model with configurable reasoning effort — great for quick agent tasks",
    contextWindow: 131_072,
    inputPrice: 0.3,
    outputPrice: 0.5,
    reasoning: true,
    supportsClientTools: true,
    reasoningEfforts: ["low", "high"],
    aliases: ["grok3-mini"],
  },
  {
    id: "grok-3",
    name: "Grok 3",
    description: "Capable, balanced Grok model — strong at reasoning and tool use",
    contextWindow: 131_072,
    inputPrice: 3.0,
    outputPrice: 15.0,
    supportsClientTools: true,
    aliases: ["grok3"],
  },
  {
    id: "grok-code-fast-1",
    name: "Grok Code Fast",
    description: "Grok model optimized for code generation and agentic coding tasks",
    contextWindow: 256_000,
    inputPrice: 1.0,
    outputPrice: 5.0,
    supportsClientTools: true,
    aliases: ["grok-code"],
  },
];

const MODEL_BY_ID = new Map<string, ModelDefinition>();
const ALIAS_MAP = new Map<string, string>();

for (const m of MODELS) {
  MODEL_BY_ID.set(m.id, m);
  ALIAS_MAP.set(m.id.toLowerCase(), m.id);
  for (const alias of m.aliases ?? []) {
    ALIAS_MAP.set(alias.toLowerCase(), m.id);
  }
}

export function getModel(id: string): ModelDefinition | undefined {
  const canonical = ALIAS_MAP.get(id.toLowerCase());
  return canonical ? MODEL_BY_ID.get(canonical) : MODEL_BY_ID.get(id);
}

export function getModelInfo(id: string): ModelDefinition | undefined {
  return getModel(id);
}

export function normalizeModelId(id: string): string {
  const canonical = ALIAS_MAP.get(id.toLowerCase());
  return canonical ?? id;
}

export function listModelIds(): string[] {
  return MODELS.map((m) => m.id);
}

export function getModelIds(): string[] {
  return listModelIds();
}

export function getSupportedReasoningEfforts(id: string): string[] {
  const info = getModel(id);
  return info?.reasoningEfforts ?? [];
}

export function getEffectiveReasoningEffort(id: string, effort?: string): string | undefined {
  const supported = getSupportedReasoningEfforts(id);
  if (supported.length === 0) return undefined;
  if (effort && supported.includes(effort)) return effort;
  return undefined;
}
