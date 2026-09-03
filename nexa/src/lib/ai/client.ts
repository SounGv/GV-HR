import Anthropic from "@anthropic-ai/sdk";

/** The AI Assistant runs on Anthropic Claude, grounded in real HR data via tool use. */

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Override with ANTHROPIC_MODEL to pin a different model. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";
