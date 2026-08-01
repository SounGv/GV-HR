import { ok, handleApiError } from "@/lib/api/response";
import { isAiConfigured } from "@/lib/ai/client";

export const runtime = "nodejs";

/**
 * Public, no-auth diagnostic: reports ONLY whether ANTHROPIC_API_KEY is present
 * in this deployment's environment (a boolean). Never returns the key itself.
 * Used to verify the AI env var is set on the server after a deploy.
 */
export async function GET() {
  try {
    return ok({ configured: isAiConfigured() });
  } catch (err) {
    return handleApiError(err);
  }
}
