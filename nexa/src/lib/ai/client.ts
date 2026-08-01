import { GoogleGenerativeAI } from "@google/generative-ai";

/** NEXA AI runs on Google Gemini (free tier), grounded in real HR data via function calling. */

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function getGemini(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
}

// gemini-1.5-flash has the most reliable free-tier quota across accounts/regions.
// Override with GEMINI_MODEL (e.g. gemini-2.0-flash / gemini-2.5-flash) if your
// key has quota for a newer model.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
