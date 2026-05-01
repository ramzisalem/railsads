import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

let _client: OpenAI | null = null;
let _gemini: GoogleGenAI | null = null;

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

/** Gemini client for image generation. Uses `GEMINI_API_KEY`. */
export function getGeminiImageClient(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set (required for image generation)"
      );
    }
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export const MODELS = {
  premium: "gpt-4.1",
  efficient: "gpt-4.1-mini",
  /** Gemini 3 Pro Image (preview) — higher-fidelity generation vs Flash Image. */
  image: "gemini-3-pro-image-preview",
} as const;

export type ModelTier = keyof typeof MODELS;

export function getModel(tier: ModelTier): string {
  return MODELS[tier];
}
