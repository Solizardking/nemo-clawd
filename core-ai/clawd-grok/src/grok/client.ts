import { createXai, type XaiProvider } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getReasoningEffortForModel } from "../utils/settings.js";
import { getEffectiveReasoningEffort, getModelInfo, type ModelDefinition, normalizeModelId } from "./models.js";

export type { XaiProvider };

const DEFAULT_TITLE_MODEL = "grok-4.20-non-reasoning";
const DEFAULT_RECAP_MODEL = "grok-4.20-non-reasoning";
const RETIRED_MODEL_MAP: Record<string, string> = {
  "grok-4-0709": "grok-4.3",
  "grok-code-fast-1": "grok-4.3",
  "grok-4-1-fast-reasoning": "grok-4.3",
  "grok-3": "grok-4.20-non-reasoning",
};

type ProviderReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface ResolvedModelRuntime {
  model: ReturnType<XaiProvider["chat"]> | ReturnType<XaiProvider["responses"]>;
  modelId: string;
  modelInfo: ModelDefinition | undefined;
  providerOptions?: {
    xai?: {
      reasoningEffort?: ProviderReasoningEffort;
    };
  };
}

export function createProvider(apiKey: string, baseURL?: string): XaiProvider {
  return createXai({
    apiKey,
    baseURL: baseURL || process.env.AI_BASE_URL || process.env.GROK_BASE_URL || "https://api.x.ai/v1",
  });
}

export function resolveModelRuntime(provider: XaiProvider, modelId: string): ResolvedModelRuntime {
  const normalizedModelId = RETIRED_MODEL_MAP[modelId] ?? normalizeModelId(modelId);
  const info = getModelInfo(normalizedModelId);
  const chatModel = provider.chat(normalizedModelId);
  const normalizedFromAlias = normalizedModelId !== modelId;
  const configuredEffort = getReasoningEffortForModel(normalizedModelId);
  const reasoningEffort = normalizedFromAlias
    ? undefined
    : (getEffectiveReasoningEffort(normalizedModelId, configuredEffort) as ProviderReasoningEffort | undefined);

  return {
    model: chatModel,
    modelId: normalizedModelId,
    modelInfo: info,
    providerOptions: reasoningEffort
      ? {
          xai: {
            reasoningEffort,
          },
        }
      : undefined,
  };
}

export interface TitleResult {
  title: string;
  modelId: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export async function generateTitle(
  provider: XaiProvider,
  userMessage: string,
  modelId = DEFAULT_TITLE_MODEL,
): Promise<TitleResult> {
  try {
    const result = await generateText({
      model: provider.chat(modelId),
      system: "Generate a short, descriptive title (max 6 words) for this conversation. Return only the title.",
      messages: [{ role: "user", content: userMessage.slice(0, 500) }],
      maxOutputTokens: 32,
    });

    return {
      title: result.text?.trim() || "New session",
      modelId,
      usage: result.usage
        ? {
            inputTokens:
              (result.usage as { inputTokens?: number; promptTokens?: number }).inputTokens ??
              (result.usage as { promptTokens?: number }).promptTokens,
            outputTokens:
              (result.usage as { outputTokens?: number; completionTokens?: number }).outputTokens ??
              (result.usage as { completionTokens?: number }).completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch {
    return { title: "New session", modelId };
  }
}

export interface RecapResult {
  recap?: string;
  modelId: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export async function generateRecap(
  provider: XaiProvider,
  prompt: string,
  signal?: AbortSignal,
  modelId = DEFAULT_RECAP_MODEL,
): Promise<RecapResult> {
  try {
    const result = await generateText({
      model: provider.chat(modelId),
      prompt,
      maxOutputTokens: 120,
      abortSignal: signal,
      system: "You generate concise session recaps. Maximum 3 sentences total. Return only the recap text.",
    });

    return {
      recap: result.text?.trim().replace(/^["']|["']$/g, "") || "",
      modelId,
      usage: result.usage
        ? {
            inputTokens:
              (result.usage as { inputTokens?: number; promptTokens?: number }).inputTokens ??
              (result.usage as { promptTokens?: number }).promptTokens,
            outputTokens:
              (result.usage as { outputTokens?: number; completionTokens?: number }).outputTokens ??
              (result.usage as { completionTokens?: number }).completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch {
    return { recap: "", modelId };
  }
}
