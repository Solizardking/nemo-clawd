import type { TelegramSettings } from "../../utils/settings.js";
import { getApiKey, getBaseURL, resolveTelegramAudioInputSettings } from "../../utils/settings.js";
import { GrokSttEngine, type GrokSttTranscriptionResult } from "./grok-stt.js";

export interface AudioTranscriptionInput {
  audioPath: string;
  fileName?: string;
  mimeType?: string;
}

export type AudioTranscriptionResult = GrokSttTranscriptionResult;

export interface AudioTranscriptionEngine {
  transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult>;
}

export function createTelegramAudioInputEngine(
  telegramSettings: TelegramSettings | undefined,
): AudioTranscriptionEngine {
  const resolved = resolveTelegramAudioInputSettings(telegramSettings);
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Clawd STT requires an API key. Set AI_API_KEY or configure apiKey in ~/.clawd/user-settings.json.",
    );
  }

  return new GrokSttEngine({
    apiKey,
    baseURL: getBaseURL(),
    language: resolved.language,
  });
}
