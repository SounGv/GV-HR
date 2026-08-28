import { AiAccessScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { revokeAllForUser } from "@/lib/auth/token-store";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { RoleCreateInput, RoleUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

/** Replace a role's permission set with the given permission keys. */
async function setRolePermissions(roleId: string, keys: string[]) {
  const perms = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  if (perms.length > 0) {
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}

export async function listRoles(companyId: string) {
  const roles = await prisma.role.findMany({
    where: { OR: [{ companyId }, { companyId: null }], deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissionKeys: r.permissions.map((p) => p.permission.key),
    userCount: r._count.users,
  }));
}

export async function createRole(
  companyId: string,
  session: AccessClaims,
  input: RoleCreateInput,
  meta?: Meta,
) {
  const role = await prisma.role.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      isSystem: false,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await setRolePermissions(role.id, input.permissions);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "role.create",
    entity: "Role",
    entityId: role.id,
    after: { name: input.name, permissions: input.permissions.length },
    ...meta,
  });

  return { id: role.id };
}

export async function updateRole(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: RoleUpdateInput,
  meta?: Meta,
) {
  const role = await prisma.role.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, isSystem: true },
  });
  if (!role) throw NotFound("ไม่พบบทบาท");
  if (role.isSystem) throw Forbidden("ไม่สามารถแก้ไขบทบาทของระบบได้");

  await prisma.role.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedById: session.sub,
    },
  });
  if (input.permissions) await setRolePermissions(id, input.permissions);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "role.update",
    entity: "Role",
    entityId: id,
    ...meta,
  });

  return { id };
}

export async function deleteRole(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const role = await prisma.role.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, isSystem: true, _count: { select: { users: true } } },
  });
  if (!role) throw NotFound("ไม่พบบทบาท");
  if (role.isSystem) throw Forbidden("ไม่สามารถลบบทบาทของระบบได้");
  if (role._count.users > 0) throw BadRequest("มีผู้ใช้ที่ยังใช้บทบาทนี้อยู่ กรุณาย้ายผู้ใช้ก่อน");

  await prisma.role.delete({ where: { id } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "role.delete",
    entity: "Role",
    entityId: id,
    ...meta,
  });
}

export async function listUsers(companyId: string) {
  const users = await prisma.user.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      email: true,
      username: true,
      status: true,
      roles: { select: { role: { select: { id: true, name: true } } } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          aiAccessGrant: { select: { scope: true } },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    status: u.status,
    employee: u.employee
      ? {
          id: u.employee.id,
          firstName: u.employee.firstName,
          lastName: u.employee.lastName,
          employeeCode: u.employee.employeeCode,
        }
      : null,
    aiAccessScope: u.employee?.aiAccessGrant?.scope ?? null,
    roleIds: u.roles.map((r) => r.role.id),
    roleNames: u.roles.map((r) => r.role.name),
  }));
}

export async function getUser(companyId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      email: true,
      username: true,
      status: true,
      roles: { select: { role: { select: { id: true, name: true } } } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          aiAccessGrant: { select: { scope: true } },
        },
      },
    },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    status: user.status,
    employee: user.employee
      ? {
          id: user.employee.id,
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          employeeCode: user.employee.employeeCode,
        }
      : null,
    aiAccessScope: user.employee?.aiAccessGrant?.scope ?? null,
    roleIds: user.roles.map((r) => r.role.id),
    roleNames: user.roles.map((r) => r.role.name),
  };
}

export async function setAiAccessGrant(
  companyId: string,
  session: AccessClaims,
  userId: string,
  scope: AiAccessScope,
  meta?: Meta,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { employee: { select: { id: true } } },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");
  if (!user.employee) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงกำหนดขอบเขต AI ให้ไม่ได้");

  const grant = await prisma.aiAccessGrant.upsert({
    where: { employeeId: user.employee.id },
    create: { companyId, employeeId: user.employee.id, scope, grantedById: session.sub },
    update: { scope, grantedById: session.sub },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai_access_grant.set",
    entity: "AiAccessGrant",
    entityId: grant.id,
    after: { userId, employeeId: user.employee.id, scope },
    ...meta,
  });

  return grant;
}

export async function revokeAiAccessGrant(
  companyId: string,
  session: AccessClaims,
  userId: string,
  meta?: Meta,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { employee: { select: { id: true } } },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");
  if (!user.employee) return; // nothing to revoke

  const grant = await prisma.aiAccessGrant.findUnique({
    where: { employeeId: user.employee.id },
    select: { id: true },
  });
  if (!grant) return; // idempotent

  await prisma.aiAccessGrant.delete({ where: { id: grant.id } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai_access_grant.revoke",
    entity: "AiAccessGrant",
    entityId: grant.id,
    before: { userId, employeeId: user.employee.id },
    ...meta,
  });
}

export async function setUserRoles(
  companyId: string,
  session: AccessClaims,
  userId: string,
  roleIds: string[],
  meta?: Meta,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");

  if (roleIds.length > 0) {
    const valid = await prisma.role.count({
      where: { id: { in: roleIds }, OR: [{ companyId }, { companyId: null }], deletedAt: null },
    });
    if (valid !== roleIds.length) throw BadRequest("มีบทบาทที่ไม่ถูกต้อง");
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    ...(roleIds.length > 0
      ? [prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })), skipDuplicates: true })]
      : []),
  ]);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "user.set_roles",
    entity: "User",
    entityId: userId,
    after: { roleIds },
    ...meta,
  });
}

/**
 * Removes a login account (soft-delete — same convention as Employee, and
 * the User.deletedAt column this reuses was otherwise unused). Refuses to
 * touch an account that's still a currently-active employee's login: that
 * case must go through the employee "delete" flow first (which disables
 * the account), so an admin never locks someone out by mistake here — this
 * is strictly for cleaning up orphaned/test logins.
 */
export async function deleteUser(
  companyId: string,
  session: AccessClaims,
  userId: string,
  meta?: Meta,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { id: true, email: true, username: true, employee: { select: { id: true, deletedAt: true } } },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");
  if (userId === session.sub) throw Forbidden("ไม่สามารถลบบัญชีของตัวเองได้");
  if (user.employee && !user.employee.deletedAt) {
    throw BadRequest("บัญชีนี้ผูกกับพนักงานที่ยังทำงานอยู่ — ต้องลบพนักงานคนนั้นก่อน");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date(), status: "DISABLED" },
  });
  await revokeAllForUser(userId);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "user.delete",
    entity: "User",
    entityId: userId,
    before: { email: user.email, username: user.username },
    ...meta,
  });
}
