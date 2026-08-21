import { GoogleGenerativeAI } from "@google/generative-ai";

/** The AI Assistant runs on Google Gemini (free tier), grounded in real HR data via function calling. */

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

/** True when the error means "try the next model" (unavailable / no quota / persistently overloaded). */
export function isModelFallbackError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // 404/429 = this key can't use this model at all. 503/UNAVAILABLE = the
  // model is up but overloaded right now — worth a couple of quick retries
  // (see isRetryableBusyError) before giving up on it and moving on.
  return /\b404\b|is not found|\b429\b|quota|exceeded|RESOURCE_EXHAUSTED|\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg);
}

/** True when the error is Gemini saying "temporarily busy" — worth retrying the *same* model briefly. */
export function isRetryableBusyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini's own 503 message says demand spikes are "usually temporary" — one
 * short retry on the *same* model/call before the caller's outer loop falls
 * through to the next model candidate often succeeds without bothering the
 * user to resend anything. Shared by every route that calls generateContent.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryableBusyError(err)) throw err;
    await sleep(1200);
    return await fn();
  }
}

export const AI_MODEL = getModelCandidates()[0];
