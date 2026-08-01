import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";
import { Conflict } from "@/lib/api/errors";
import { PERMISSIONS, ROLE_PRESETS, expandPermissions } from "@/config/permissions";
import type { RegisterInput } from "@/features/auth/schema";

/**
 * SaaS self-service signup: create a brand-new company (tenant) with its full
 * role/permission set and a first Super Admin user + employee. Each signup is
 * an isolated tenant — you can only ever create your own company, never join
 * someone else's.
 */
export async function registerCompany(input: RegisterInput): Promise<{ email: string }> {
  const email = input.email.toLowerCase().trim();

  // Email must be globally unique (login looks up users by email across tenants).
  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw Conflict("อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ");

  const passwordHash = await hashPassword(input.password);

  // Ensure the global permission catalog exists (idempotent, tenant-independent).
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, module: p.module, action: p.action, label: p.label },
    });
  }

  await prisma.$transaction(
    async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.companyName,
          timezone: "Asia/Bangkok",
          currency: "THB",
        },
      });

      // Roles (from presets) + their permissions.
      let superAdminRoleId = "";
      for (const preset of ROLE_PRESETS) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
            name: preset.name,
            description: preset.description,
            isSystem: preset.isSystem,
          },
        });
        if (preset.name === "Super Admin") superAdminRoleId = role.id;

        const keys = expandPermissions(preset.permissions);
        const perms = await tx.permission.findMany({
          where: { key: { in: keys } },
          select: { id: true },
        });
        if (perms.length) {
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      }

      // Owner user + Super Admin role + linked employee record.
      const user = await tx.user.create({
        data: { companyId: company.id, email, passwordHash, status: "ACTIVE" },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: superAdminRoleId } });
      await tx.employee.create({
        data: {
          companyId: company.id,
          userId: user.id,
          employeeCode: "EMP0001",
          firstName: input.firstName,
          lastName: input.lastName,
          email,
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
      });
    },
    { timeout: 20_000 },
  );

  return { email };
}
