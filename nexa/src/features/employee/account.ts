import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";
import { revokeAllForUser } from "@/lib/auth/token-store";
import { can } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import type { EmployeeAccountInput, EmployeeAccountUpdateInput, EmployeePasswordResetInput } from "./schema";
import { rolePermissionKeys } from "@/config/permissions";

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
        select: { roles: { select: { role: { select: { name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } } } } } },
      },
    },
  });
  if (!emp) throw NotFound("ไม่พบพนักงาน");
  if (!emp.userId) throw BadRequest("พนักงานคนนี้ยังไม่มีบัญชีเข้าใช้งาน");

  const targetKeys = new Set<string>();
  for (const ur of emp.user?.roles ?? []) {
    for (const k of rolePermissionKeys(ur.role)) targetKeys.add(k);
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

/** The login an employee has (email / username), for the edit-account form. Null when there is none. */
export async function getEmployeeLogin(companyId: string, employeeId: string) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { user: { select: { email: true, username: true, deletedAt: true } } },
  });
  if (!emp?.user || emp.user.deletedAt) return null;
  return { email: emp.user.email, username: emp.user.username };
}

/**
 * HR edits an employee's existing login: the email and/or username used to
 * sign in, and/or the password. Same escalation guard as the password reset
 * (the target's permissions must be a subset of the caller's), duplicate IDs
 * are refused, at least one login ID must remain, and any change signs the
 * user out everywhere. The audit records old and new IDs, never the password.
 */
export async function updateEmployeeAccount(
  companyId: string,
  employeeId: string,
  input: EmployeeAccountUpdateInput,
  session: SessionUser,
  meta?: Meta,
) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          email: true,
          username: true,
          deletedAt: true,
          roles: { select: { role: { select: { name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
        },
      },
    },
  });
  if (!emp) throw NotFound("ไม่พบพนักงาน");
  if (!emp.userId || !emp.user || emp.user.deletedAt) throw BadRequest("พนักงานคนนี้ยังไม่มีบัญชีเข้าใช้งาน");

  const targetKeys = new Set<string>();
  for (const ur of emp.user.roles) {
    for (const k of rolePermissionKeys(ur.role)) targetKeys.add(k);
  }
  if ([...targetKeys].some((k) => !can(session.perms, k))) {
    throw Forbidden("ไม่สามารถแก้บัญชีของผู้ใช้ที่มีสิทธิ์เกินกว่าคุณได้");
  }

  const email = input.email === undefined ? emp.user.email : input.email;
  const username = input.username === undefined ? emp.user.username : input.username;
  if (!email && !username) throw BadRequest("ต้องมีอีเมลหรือชื่อผู้ใช้อย่างน้อย 1 อย่างสำหรับเข้าสู่ระบบ");

  const emailChanged = email !== emp.user.email;
  const usernameChanged = username !== emp.user.username;
  if (!emailChanged && !usernameChanged && !input.password) throw BadRequest("ไม่มีอะไรเปลี่ยน");

  if (email && emailChanged) {
    const dupe = await prisma.user.findFirst({ where: { email, deletedAt: null, NOT: { id: emp.userId } }, select: { id: true } });
    if (dupe) throw Conflict("อีเมลนี้ถูกใช้งานแล้ว");
  }
  if (username && usernameChanged) {
    const dupe = await prisma.user.findFirst({ where: { username, deletedAt: null, NOT: { id: emp.userId } }, select: { id: true } });
    if (dupe) throw Conflict("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
  }

  const passwordHash = input.password ? await hashPassword(input.password) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: emp.userId! },
      data: { email, username, ...(passwordHash ? { passwordHash } : {}), updatedById: session.sub },
    });
    // The employee record shows the login email too; keep it in step when it changes.
    if (emailChanged && email) {
      await tx.employee.update({ where: { id: employeeId }, data: { email, updatedById: session.sub } });
    }
  });
  await revokeAllForUser(emp.userId);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee.update_account",
    entity: "Employee",
    entityId: employeeId,
    before: { email: emp.user.email, username: emp.user.username },
    after: { email, username, passwordChanged: !!input.password },
    ...meta,
  });
  return { email, username };
}
