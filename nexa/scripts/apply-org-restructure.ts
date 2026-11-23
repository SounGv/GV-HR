/**
 * Apply the Gadget Villa org restructure against a live DATABASE_URL.
 *
 * Default is dry-run (prints the plan only). Pass --yes to write.
 *
 * Usage (from nexa/):
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/apply-org-restructure.ts
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/apply-org-restructure.ts --yes
 *
 * Requires DATABASE_URL (and DIRECT_URL if you use Prisma migrate tooling; this script only needs DATABASE_URL).
 */
import { PrismaClient } from "@prisma/client";
import {
  planOrgRestructure,
  type RestructureDept,
  type RestructurePerson,
} from "../src/features/organization/org-restructure";
import { checkOrgMoves } from "../src/features/organization/org-tree";

const apply = process.argv.includes("--yes");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Put it in .env.local and re-run with --env-file=.env.local");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const companies = await prisma.company.findMany({ select: { id: true, name: true, legalName: true } });
    if (companies.length === 0) {
      console.error("No company rows found.");
      process.exit(1);
    }
    const company = process.env.COMPANY_ID
      ? companies.find((c) => c.id === process.env.COMPANY_ID)
      : (companies.find((c) => /แก็ดเจ็ท|Gadget\s*Villa/i.test(`${c.name} ${c.legalName ?? ""}`)) ??
        (companies.length === 1 ? companies[0]! : null));
    if (!company) {
      console.error(
        process.env.COMPANY_ID
          ? `COMPANY_ID=${process.env.COMPANY_ID} not found`
          : "Several companies found — set COMPANY_ID=…:\n" +
              companies.map((c) => `  ${c.id}  ${c.name}`).join("\n"),
      );
      process.exit(1);
    }
    const companyId = company.id;
    console.log(`Company: ${company.name} (${companyId})`);
    console.log(apply ? "MODE: APPLY (--yes)" : "MODE: dry-run (pass --yes to write)");
    console.log("");

    const depts: RestructureDept[] = await prisma.department.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, code: true, parentId: true },
    });
    const peopleRaw = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        departmentId: true,
        managerId: true,
        position: { select: { title: true } },
      },
    });
    const people: RestructurePerson[] = peopleRaw.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      nickname: p.nickname,
      departmentId: p.departmentId,
      managerId: p.managerId,
      positionTitle: p.position?.title ?? null,
    }));

    const plan = planOrgRestructure(people, depts);

    console.log("— Department changes —");
    if (plan.deptChanges.length === 0) console.log("  (none)");
    for (const c of plan.deptChanges) {
      if (c.kind === "create") console.log(`  CREATE ${c.name} [${c.code}]  — ${c.reason}`);
      else if (c.kind === "rename") console.log(`  RENAME ${c.id} → ${c.name}  — ${c.reason}`);
      else
        console.log(
          `  DETACH ${c.id}${c.name ? ` rename→ ${c.name}` : ""}  — ${c.reason}`,
        );
    }

    console.log("\n— Person moves (department / manager) —");
    if (plan.personMoves.length === 0) console.log("  (none)");
    for (const m of plan.personMoves) {
      console.log(`  ${m.label}`);
      console.log(`    dept=${m.departmentId ?? "null"}  manager=${m.managerId ?? "null"}`);
      console.log(`    ${m.reason}`);
    }

    if (plan.notes.length) {
      console.log("\n— Notes —");
      for (const n of plan.notes) console.log(`  • ${n}`);
    }
    if (plan.unresolved.length) {
      console.log("\n— Unresolved (fix before --yes) —");
      for (const u of plan.unresolved) console.log(`  ✗ ${u}`);
    }

    if (plan.unresolved.length > 0) {
      console.error("\nAborting: resolve the names above (or fix nicknames in HR) then re-run.");
      process.exit(2);
    }

    const moveCheck = checkOrgMoves(
      people.map((p) => ({
        id: p.id,
        departmentId: p.departmentId,
        managerId: p.managerId,
      })),
      plan.personMoves.map((m) => ({
        employeeId: m.employeeId,
        departmentId: m.departmentId === "__CREATE_DATA_ENG__" ? null : m.departmentId,
        managerId: m.managerId,
      })),
    );
    // Temporary null dept for DATA-ENG create is OK for cycle check; real id is set on apply.
    if (moveCheck && moveCheck.kind !== "duplicate") {
      // Allow null dept only for the Ob→DATA-ENG placeholder; cycle/self still matter.
      if (moveCheck.kind === "self" || moveCheck.kind === "cycle") {
        console.error("\nOrg move validation failed:", moveCheck);
        process.exit(2);
      }
    }

    if (!apply) {
      console.log("\nDry-run only. Re-run with --yes to write.");
      return;
    }

    const actor =
      (await prisma.user.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ?? null;

    await prisma.$transaction(
      async (tx) => {
        let dataEngId: string | null = null;
        for (const c of plan.deptChanges) {
          if (c.kind === "create") {
            const existing = await tx.department.findFirst({
              where: { companyId, code: c.code },
              select: { id: true, deletedAt: true },
            });
            if (existing && !existing.deletedAt) {
              dataEngId = existing.id;
              continue;
            }
            if (existing?.deletedAt) {
              const restored = await tx.department.update({
                where: { id: existing.id },
                data: { deletedAt: null, name: c.name, parentId: null, updatedById: actor?.id },
                select: { id: true },
              });
              dataEngId = restored.id;
              continue;
            }
            const created = await tx.department.create({
              data: {
                companyId,
                name: c.name,
                code: c.code,
                parentId: null,
                createdById: actor?.id,
                updatedById: actor?.id,
              },
              select: { id: true },
            });
            dataEngId = created.id;
            if (actor) {
              await tx.auditLog.create({
                data: {
                  companyId,
                  actorUserId: actor.id,
                  action: "department.create",
                  entity: "Department",
                  entityId: created.id,
                  after: { name: c.name, code: c.code, reason: c.reason },
                },
              });
            }
          } else if (c.kind === "rename") {
            await tx.department.update({
              where: { id: c.id },
              data: { name: c.name, updatedById: actor?.id },
            });
            if (actor) {
              await tx.auditLog.create({
                data: {
                  companyId,
                  actorUserId: actor.id,
                  action: "department.update",
                  entity: "Department",
                  entityId: c.id,
                  after: { name: c.name, reason: c.reason },
                },
              });
            }
          } else {
            await tx.department.update({
              where: { id: c.id },
              data: {
                parentId: null,
                ...(c.name ? { name: c.name } : {}),
                updatedById: actor?.id,
              },
            });
            if (actor) {
              await tx.auditLog.create({
                data: {
                  companyId,
                  actorUserId: actor.id,
                  action: "department.update",
                  entity: "Department",
                  entityId: c.id,
                  after: { parentId: null, name: c.name ?? undefined, reason: c.reason },
                },
              });
            }
          }
        }

        for (const m of plan.personMoves) {
          const departmentId =
            m.departmentId === "__CREATE_DATA_ENG__" ? dataEngId : m.departmentId;
          if (m.departmentId === "__CREATE_DATA_ENG__" && !departmentId) {
            throw new Error("Data Engineer department was not created");
          }
          const before = people.find((p) => p.id === m.employeeId)!;
          await tx.employee.update({
            where: { id: m.employeeId },
            data: {
              departmentId,
              managerId: m.managerId,
              updatedById: actor?.id,
            },
          });
          if (actor) {
            await tx.auditLog.create({
              data: {
                companyId,
                actorUserId: actor.id,
                action: "employee.org_move",
                entity: "Employee",
                entityId: m.employeeId,
                before: { departmentId: before.departmentId, managerId: before.managerId },
                after: { departmentId, managerId: m.managerId, reason: m.reason },
              },
            });
          }
        }
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    console.log(
      `\nApplied ${plan.deptChanges.length} department change(s) and ${plan.personMoves.length} person move(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
