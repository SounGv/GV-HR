import { GoogleGenerativeAI } from "@google/generative-ai";

/** NEXA AI runs on Google Gemini (free tier), grounded in real HR data via function calling. */

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function getGemini(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
}

// Free-tier friendly default; override with GEMINI_MODEL (e.g. gemini-2.5-flash).
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
