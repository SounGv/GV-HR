import { getSession, type SessionUser } from "./session";
import { can, canAny } from "./rbac";
import { Unauthorized, Forbidden } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";

/** Records a denied access attempt — the "Permission Audit" trail, distinct from action audit logs. */
function logDenied(session: SessionUser, permission: string): void {
  writeAudit({
    companyId: session.companyId,
    actorUserId: session.sub,
    action: "permission.denied",
    entity: "Permission",
    entityId: permission,
  }).catch(() => {}); // never let audit logging break the request
}

/**
 * Route-handler guards. Throw AppError; wrap handler bodies in try/catch and
 * pass to `handleApiError`. Usage:
 *
 *   export async function GET() {
 *     try {
 *       const session = await requirePermission("employee:read");
 *       ...
 *     } catch (e) { return handleApiError(e); }
 *   }
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw Unauthorized();
  return session;
}

export async function requirePermission(permission: string): Promise<SessionUser> {
  const session = await requireSession();
  if (!can(session.perms, permission)) {
    logDenied(session, permission);
    throw Forbidden();
  }
  return session;
}

export async function requireAnyPermission(permissions: string[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!canAny(session.perms, permissions)) {
    logDenied(session, permissions.join("|"));
    throw Forbidden();
  }
  return session;
}
