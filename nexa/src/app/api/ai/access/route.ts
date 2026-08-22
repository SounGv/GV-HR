import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { resolveAiAccess } from "@/lib/ai/scope";

export const runtime = "nodejs";

/**
 * Whether the current user can reach the AI Assistant at all, and at what
 * data scope — combines role-based ai:read with an HR-granted per-employee
 * override (see src/lib/ai/scope.ts). Client components (nav item, floating
 * launcher, reports page AI button) call this instead of relying on
 * session.perms alone, since a grant-only user has no ai:* permission key
 * in their JWT claims at all.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const access = await resolveAiAccess(session);
    return ok(access);
  } catch (err) {
    return handleApiError(err);
  }
}
