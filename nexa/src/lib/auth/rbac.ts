import type { SessionUser } from "./session";

/**
 * Permission check with wildcard support.
 *   "*"            → all permissions (super admin)
 *   "employee:*"   → any action on the employee module
 *   "employee:read"→ that exact permission
 */
export function can(perms: string[], required: string): boolean {
  if (perms.includes("*")) return true;
  if (perms.includes(required)) return true;
  const [mod] = required.split(":");
  return perms.includes(`${mod}:*`);
}

export function canAny(perms: string[], required: string[]): boolean {
  return required.some((r) => can(perms, r));
}

export function canAll(perms: string[], required: string[]): boolean {
  return required.every((r) => can(perms, r));
}

/** Convenience against a session. */
export function sessionCan(session: SessionUser | null, required: string): boolean {
  return !!session && can(session.perms, required);
}
