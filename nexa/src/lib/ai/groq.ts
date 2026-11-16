import { BACKUP_SYSTEM_PROMPT } from "@/features/ai/backup-ai";

/** The free backup AI: Groq's OpenAI-compatible chat endpoint, called with plain fetch (no new dependency). */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** Override with GROQ_MODEL. */
const MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const TIMEOUT_MS = 25_000;

export function isBackupConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * One question in, one answer out; null on any failure (key rejected, limit reached, timeout, empty answer), so the caller can
 * fall back to the quick buttons without a second error path. The reason goes to the server log, never to the page.
 */
export async function askBackup(question: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: BACKUP_SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        max_tokens: 1024,
        temperature: 0.3,
        // The gpt-oss models think before answering; a short question does not need much of it.
        ...(MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[ai/backup] Groq answered", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("[ai/backup] call failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
