import { ok, handleApiError } from "@/lib/api/response";
import { isAiConfigured, getModelCandidates } from "@/lib/ai/client";

export const runtime = "nodejs";

/**
 * Public, no-auth diagnostic: reports ONLY whether GEMINI_API_KEY is present
 * (a boolean) and which Gemini models the server will try. Never returns the key.
 */
export async function GET() {
  try {
    return ok({ configured: isAiConfigured(), models: getModelCandidates() });
  } catch (err) {
    return handleApiError(err);
  }
}
