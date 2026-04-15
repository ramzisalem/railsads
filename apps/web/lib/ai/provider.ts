import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export const MODELS = {
  premium: "gpt-4.1",
  efficient: "gpt-4.1-mini",
  image: "gpt-image-1",
} as const;

export type ModelTier = keyof typeof MODELS;

export function getModel(tier: ModelTier): string {
  return MODELS[tier];
}
