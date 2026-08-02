import { GoogleGenerativeAI } from "@google/generative-ai";

/** NEXA AI runs on Google Gemini (free tier), grounded in real HR data via function calling. */

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function getGemini(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
}

/**
 * Which Gemini model each key can use (and with free quota) varies a lot. Try a
 * list of candidates and use the first that works — skipping ones that 404
 * (not available for this key) or 429 (no free-tier quota). Override with
 * GEMINI_MODEL to pin a single model.
 */
export function getModelCandidates(): string[] {
  const override = process.env.GEMINI_MODEL?.trim();
  if (override) return [override];
  return [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
  ];
}

/** True when the error means "try the next model" (unavailable / no quota). */
export function isModelFallbackError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Only fall through when the MODEL is unavailable (404) or out of quota (429).
  return /\b404\b|is not found|\b429\b|quota|exceeded|RESOURCE_EXHAUSTED/i.test(msg);
}

export const AI_MODEL = getModelCandidates()[0];
