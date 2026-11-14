import { AppError } from "@/lib/api/errors";
import { describeAiFailure } from "@/features/ai/ai-error";

/**
 * Turns a failed call to the AI service into an error the page can show: the cause in plain Thai (credit out, key
 * not working, too busy) instead of a bare "เกิดข้อผิดพลาด". Anything that is not a failure of the AI service
 * itself is returned as it is. The raw message goes to the server log only.
 */
export function friendlyAiError(err: unknown): unknown {
  if (err instanceof AppError) return err;
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  // The service's own errors carry its HTTP status; a plain bug in our code has none.
  if (status === undefined) return err;
  console.error("[ai] call to the AI service failed:", message.slice(0, 600));
  return new AppError(status === 429 ? "RATE_LIMITED" : "INTERNAL", status === 429 ? 429 : 503, describeAiFailure(status, message));
}
