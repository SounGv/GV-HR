import { NoEmployee } from "@/lib/api/errors";

/**
 * The signed-in person's employee id, for anything that is "mine" (my leave,
 * my expenses, clocking in). Accounts with no employee record (admin, system
 * accounts) get NO_EMPLOYEE (403), not BAD_REQUEST: nothing in the request was
 * wrong, so the page can say "this account is not linked to an employee"
 * instead of blaming the network (audit B1/B2, 13 Nov 2026). Read-only "my"
 * lists should check `hasEmployee` first and return an empty list instead.
 */
export function requireEmployeeId(session: { employeeId?: string | null }, message?: string): string {
  if (!session.employeeId) throw NoEmployee(message);
  return session.employeeId;
}

/** Whether this account is linked to an employee record. */
export function hasEmployee(session: { employeeId?: string | null }): boolean {
  return !!session.employeeId;
}
