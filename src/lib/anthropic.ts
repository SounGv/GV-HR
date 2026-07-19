import Anthropic from "@anthropic-ai/sdk";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า กรุณาแจ้งผู้ดูแลระบบให้เพิ่มค่านี้ใน Environment variables");
    this.name = "AiNotConfiguredError";
  }
}

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return new Anthropic({ apiKey });
}

export function extractJson<T>(text: string): T | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
