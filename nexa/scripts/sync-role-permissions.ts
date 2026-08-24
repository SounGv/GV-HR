/**
 * Backfill system-role permissions for every already-provisioned company.
 *
 * Why this exists: `src/config/permissions.ts` is the single source of truth
 * for what each system role ("Super Admin"/"HR Manager"/"Manager"/"Employee"/
 * "Finance") should be able to do, but that file only ever gets *read* into
 * the database at two points — brand-new company signup (`registerCompany`)
 * and the single demo company in `prisma/seed.ts`. Any permission added to
 * the catalog after a company already exists never reaches that company's
 * roles on its own — there's no live sync. Run this once after adding a new
 * permission (e.g. `campaign:manage`) so every existing company's system
 * roles catch up. Additive only: it never removes a permission a role
 * already has, so it's safe to re-run any time and cannot revoke access.
 *
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/sync-role-permissions.ts
 */
import { prisma } from "../src/lib/prisma";
import { PERMISSIONS, ROLE_PRESETS, expandPermissions } from "../src/config/permissions";

async function main() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, label: p.label },
      create: { key: p.key, module: p.module, action: p.action, label: p.label },
    });
  }

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  let totalAdded = 0;

  for (const company of companies) {
    for (const preset of ROLE_PRESETS) {
      const role = await prisma.role.findFirst({
        where: { companyId: company.id, name: preset.name, isSystem: true },
        select: { id: true },
      });
      if (!role) {
        console.warn(`[skip] "${company.name}" has no system role "${preset.name}"`);
        continue;
      }

      const keys = expandPermissions(preset.permissions);
      const perms = await prisma.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true },
      });
      if (perms.length === 0) continue;

      const result = await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
      if (result.count > 0) {
        console.log(`[sync] "${company.name}" / ${preset.name}: +${result.count} permission(s)`);
        totalAdded += result.count;
      }
    }
  }

  console.log(`Done. ${companies.length} company(ies) checked, ${totalAdded} permission grant(s) added.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
