import { getSession, type SessionUser } from "./session";
import { can, canAny } from "./rbac";
import { Unauthorized, Forbidden } from "@/lib/api/errors";

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
  if (!can(session.perms, permission)) throw Forbidden();
  return session;
}

export async function requireAnyPermission(permissions: string[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!canAny(session.perms, permissions)) throw Forbidden();
  return session;
}
