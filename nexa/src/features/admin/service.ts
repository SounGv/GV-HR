import { AiAccessScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { revokeAllForUser } from "@/lib/auth/token-store";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { RoleCreateInput, RoleUpdateInput } from "./schema";
import { rolePermissionKeys } from "@/config/permissions";
import { isCompanyWideEmployeeViewer } from "@/features/employee/service";

type Meta = { ip?: string; userAgent?: string };

/**
 * A caller can only ever grant permissions they hold themselves — otherwise
 * anyone holding just `admin:update` could hand a role every permission in
 * the system (including ones only Super Admin has) and assign it to
 * themselves. `can()` already understands wildcards (`admin:*`, `*`), so
 * this check is a straight per-key subset test against the caller's own
 * `session.perms`.
 */
function assertGrantable(session: AccessClaims, keys: string[]) {
  const notOwned = keys.filter((k) => !can(session.perms, k));
  if (notOwned.length > 0) {
    throw Forbidden(`ไม่สามารถมอบสิทธิ์ที่คุณเองไม่มีให้ผู้อื่นได้: ${notOwned.join(", ")}`);
  }
}

/**
 * Looks up the permission rows for the given keys. Call this (and assertGrantable) BEFORE writing anything, so a
 * refused grant leaves nothing behind; the actual replace then runs inside the caller's transaction.
 */
async function resolvePermissionIds(session: AccessClaims, keys: string[]) {
  assertGrantable(session, keys);
  const perms = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  return perms.map((p) => p.id);
}

/** Replace a role's permission set, inside the caller's transaction. */
async function replaceRolePermissions(
  tx: { rolePermission: typeof prisma.rolePermission },
  roleId: string,
  permissionIds: string[],
) {
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (permissionIds.length > 0) {
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
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
    permissionKeys: rolePermissionKeys(r),
    userCount: r._count.users,
  }));
}

export async function createRole(
  companyId: string,
  session: AccessClaims,
  input: RoleCreateInput,
  meta?: Meta,
) {
  const permissionIds = await resolvePermissionIds(session, input.permissions);
  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
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
    await replaceRolePermissions(tx, created.id, permissionIds);
    return created;
  });

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

  // Check the grant first, then write the role fields and its permissions together (one transaction).
  const permissionIds = input.permissions ? await resolvePermissionIds(session, input.permissions) : null;
  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedById: session.sub,
      },
    });
    if (permissionIds) await replaceRolePermissions(tx, id, permissionIds);
  });

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
          nickname: true,
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
          nickname: u.employee.nickname,
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
          nickname: true,
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
          nickname: user.employee.nickname,
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
  if (!user.employee) throw BadRequest("ไม่สามารถกำหนดขอบเขต AI ให้ได้ เพราะบัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  // Company-wide AI answers are as wide as HR's own view, so only someone who already has that view may grant it.
  if (scope === "COMPANY" && !isCompanyWideEmployeeViewer(session)) {
    throw Forbidden("กำหนดขอบเขต AI ทั้งบริษัทได้เฉพาะผู้ที่ดูข้อมูลพนักงานทั้งบริษัทได้");
  }

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
    select: {
      id: true,
      roles: {
        select: {
          roleId: true,
          role: { select: { name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } } },
        },
      },
    },
  });
  if (!user) throw NotFound("ไม่พบผู้ใช้");

  // Changing the roles of someone who holds more than the caller (Super Admin) is a way to lock them out, and
  // emptying your own roles locks yourself out, so both are refused.
  if (userId === session.sub && roleIds.length === 0) {
    throw Forbidden("ลบบทบาททั้งหมดของตัวเองไม่ได้ ให้ผู้ดูแลคนอื่นทำแทน");
  }
  if (userId !== session.sub) {
    const heldKeys = new Set(user.roles.flatMap((r) => rolePermissionKeys(r.role)));
    if ([...heldKeys].some((k) => !can(session.perms, k))) {
      throw Forbidden("แก้บทบาทของผู้ใช้ที่มีสิทธิ์เกินกว่าคุณไม่ได้");
    }
  }
  // Keep at least one Super Admin in the company.
  const holdsSuperAdmin = user.roles.some((r) => r.role.isSystem && r.role.name === "Super Admin");
  if (holdsSuperAdmin) {
    const keepsIt = roleIds.length > 0 && (await prisma.role.count({
      where: { id: { in: roleIds }, isSystem: true, name: "Super Admin" },
    })) > 0;
    if (!keepsIt) {
      const others = await prisma.userRole.count({
        where: {
          userId: { not: userId },
          role: { isSystem: true, name: "Super Admin" },
          user: { companyId, deletedAt: null, status: "ACTIVE" },
        },
      });
      if (others === 0) throw BadRequest("ต้องมี Super Admin อย่างน้อย 1 คน ตั้ง Super Admin คนอื่นก่อนแล้วจึงเอาบทบาทนี้ออก");
    }
  }

  if (roleIds.length > 0) {
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds }, OR: [{ companyId }, { companyId: null }], deletedAt: null },
      select: { id: true, name: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } },
    });
    if (roles.length !== roleIds.length) throw BadRequest("มีบทบาทที่ไม่ถูกต้อง");
    // Same reasoning as assertGrantable for role permissions: assigning a
    // role can't hand the target user permissions the caller doesn't have.
    // Roles the user already holds aren't a new grant, so keeping them must
    // not block unrelated edits.
    const heldRoleIds = new Set(user.roles.map((r) => r.roleId));
    const grantedKeys = [
      ...new Set(
        roles.filter((r) => !heldRoleIds.has(r.id)).flatMap((r) => rolePermissionKeys(r)),
      ),
    ];
    assertGrantable(session, grantedKeys);
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
