import Anthropic from "@anthropic-ai/sdk";

/** NEXA AI runs on Claude via the Anthropic SDK, grounded in real HR data through tool use. */

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** The SDK resolves ANTHROPIC_API_KEY from the environment. */
export function getAnthropic(): Anthropic {
  return new Anthropic();
}

// Default to the most capable model; override with ANTHROPIC_MODEL (e.g. claude-sonnet-5
// or claude-haiku-4-5) to trade capability for cost.
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
