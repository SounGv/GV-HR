import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { EmployeeAccountInput } from "./schema";

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

  const email = input.email.toLowerCase().trim();
  const dupe = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
  if (dupe) throw Conflict("อีเมลนี้ถูกใช้งานแล้ว");

  const role = await prisma.role.findFirst({
    where: { companyId, name: "Employee" },
    select: { id: true },
  });
  if (!role) throw BadRequest("ไม่พบบทบาท “Employee” ในองค์กร กรุณาสร้างบทบาทก่อน");

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { companyId, email, passwordHash, status: "ACTIVE" },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.employee.update({
      where: { id: employeeId },
      data: { userId: user.id, email, updatedById: session.sub },
    });
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee.create_account",
    entity: "Employee",
    entityId: employeeId,
    after: { email },
    ...meta,
  });

  return { email };
}
