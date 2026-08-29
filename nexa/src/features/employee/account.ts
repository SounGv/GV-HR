import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";
import { revokeAllForUser } from "@/lib/auth/token-store";
import { can } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import type { EmployeeAccountInput, EmployeePasswordResetInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

/**
 * Create a login account for an employee: a User (hashed password) with the
 * company's "Employee" role, linked back to the employee. HR-set initial
 * password. Idempotent guard: fails if the employee already has an account or
 * the email is taken.
 */
export async function createEmployeeAccount(
  companyId: string,
  employeeId: string,
  input: EmployeeAccountInput,
  session: SessionUser,
  meta?: Meta,
) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!emp) throw NotFound("ไม่พบพนักงาน");
  if (emp.userId) throw Conflict("พนักงานคนนี้มีบัญชีเข้าใช้งานแล้ว");

  const email = input.email ? input.email.toLowerCase().trim() : null;
  const username = input.username ? input.username.toLowerCase().trim() : null;

  if (email) {
    const dupe = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
    if (dupe) throw Conflict("อีเมลนี้ถูกใช้งานแล้ว");
  }
  if (username) {
    const dupe = await prisma.user.findFirst({ where: { username, deletedAt: null }, select: { id: true } });
    if (dupe) throw Conflict("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
  }

  const role = await prisma.role.findFirst({
    where: { companyId, name: "Employee" },
    select: { id: true },
  });
  if (!role) throw BadRequest("ไม่พบบทบาท “Employee” ในองค์กร กรุณาสร้างบทบาทก่อน");

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { companyId, email, username, passwordHash, status: "ACTIVE" },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.employee.update({
      where: { id: employeeId },
      data: { userId: user.id, ...(email ? { email } : {}), updatedById: session.sub },
    });
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee.create_account",
    entity: "Employee",
    entityId: employeeId,
    after: { email, username },
    ...meta,
  });

  return { email, username };
}

/**
 * HR resets the password of an employee who already has a login account.
 * Revokes all of that user's existing refresh tokens so they're signed out
 * everywhere and must log in again with the new password.
 *
 * Guarded against privilege escalation: `employee:update` is meant for HR
 * data management, not system administration — without this check, anyone
 * holding it (e.g. HR Manager, who intentionally has no admin:* permission)
 * could reset ANY user's password, including Super Admin's, since this
 * endpoint only needs the target's email/username to reach. The target
 * user's own effective permissions must be a subset of the caller's.
 */
export async function resetEmployeeAccountPassword(
  companyId: string,
  employeeId: string,
  input: EmployeePasswordResetInput,
  session: SessionUser,
  meta?: Meta,
) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      user: {
        select: { roles: { select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } } } },
      },
    },
  });
  if (!emp) throw NotFound("ไม่พบพนักงาน");
  if (!emp.userId) throw BadRequest("พนักงานคนนี้ยังไม่มีบัญชีเข้าใช้งาน");

  const targetKeys = new Set<string>();
  for (const ur of emp.user?.roles ?? []) {
    for (const rp of ur.role.permissions) targetKeys.add(rp.permission.key);
  }
  const notOwned = [...targetKeys].filter((k) => !can(session.perms, k));
  if (notOwned.length > 0) {
    throw Forbidden("ไม่สามารถรีเซ็ตรหัสผ่านของผู้ใช้ที่มีสิทธิ์เกินกว่าคุณได้");
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: emp.userId }, data: { passwordHash, updatedById: session.sub } });
  await revokeAllForUser(emp.userId);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee.reset_account_password",
    entity: "Employee",
    entityId: employeeId,
    ...meta,
  });
}
