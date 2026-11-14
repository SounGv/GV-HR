import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { canAttachFiles, resolveAiAccess } from "@/lib/ai/scope";
import { can } from "@/lib/auth/rbac";
import { engineStatus } from "@/lib/ai/engine";

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
    const e = access.allowed ? await engineStatus(session.companyId) : null;
    return ok({
      ...access,
      canAttach: access.allowed && canAttachFiles(session),
      canManage: can(session.perms, "employee:update"),
      engine: e && {
        mode: e.decision.mode,
        reason: e.decision.mode === "fallback" ? e.decision.reason : undefined,
        used: e.used,
        cap: e.cap,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
