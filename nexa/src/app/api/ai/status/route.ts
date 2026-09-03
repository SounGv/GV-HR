import { ok, handleApiError } from "@/lib/api/response";
import { isAiConfigured, AI_MODEL } from "@/lib/ai/client";

export const runtime = "nodejs";

/**
 * Public, no-auth diagnostic: reports ONLY whether ANTHROPIC_API_KEY is
 * present (a boolean) and which model the server will use. Never returns the key.
 */
export async function GET() {
  try {
    return ok({ configured: isAiConfigured(), model: AI_MODEL });
  } catch (err) {
    return handleApiError(err);
  }
}
