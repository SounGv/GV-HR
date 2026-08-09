import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { deriveStatus } from "@/features/kpi/service";
import type { AccessClaims } from "@/lib/auth/jwt";
import { kpiImportRowSchema } from "./schema";
import type { ImportSummary } from "@/features/employee-import/schema";

type Meta = { ip?: string; userAgent?: string };

/**
 * Bulk-imports KPI targets. Upserts by (employee, title, cycle) — re-running
 * an import for the same cycle updates progress/target instead of creating
 * duplicate goals.
 */
export async function importKpiGoals(
  companyId: string,
  session: AccessClaims,
  rawRows: Record<string, unknown>[],
  meta?: Meta,
): Promise<ImportSummary> {
  const errors: ImportSummary["errors"] = [];
  const warnings: string[] = [];
  const valid: { row: ReturnType<typeof kpiImportRowSchema.parse>; index: number }[] = [];

  rawRows.forEach((raw, i) => {
    const parsed = kpiImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 1, code: String(raw.employeeCode ?? "-"), message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
      return;
    }
    valid.push({ row: parsed.data, index: i + 1 });
  });

  const codes = [...new Set(valid.map((v) => v.row.employeeCode))];
  const employees = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: codes }, deletedAt: null },
    select: { id: true, employeeCode: true },
  });
  const empByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

  let created = 0;
  let updated = 0;

  for (const { row: r, index } of valid) {
    const employeeId = empByCode.get(r.employeeCode);
    if (!employeeId) {
      errors.push({ row: index, code: r.employeeCode, message: "ไม่พบรหัสพนักงานนี้ในระบบ" });
      continue;
    }

    const existing = await prisma.goal.findFirst({
      where: { companyId, employeeId, title: r.title, cycle: r.cycle, deletedAt: null },
      select: { id: true },
    });

    const status = deriveStatus(r.currentValue, r.targetValue);
    const data = {
      unit: r.unit ?? "%",
      targetValue: r.targetValue,
      currentValue: r.currentValue,
      weight: r.weight,
      status,
      dueDate: r.dueDate ? new Date(r.dueDate) : null,
      updatedById: session.sub,
    };

    if (existing) {
      await prisma.goal.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.goal.create({
        data: {
          companyId,
          employeeId,
          ownerEmployeeId: session.employeeId ?? null,
          ownerUserId: session.sub,
          title: r.title,
          type: "KPI",
          cycle: r.cycle,
          ...data,
          createdById: session.sub,
        },
      });
      created++;
    }
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "kpi.import",
    entity: "Goal",
    after: { created, updated, errors: errors.length },
    ...meta,
  });

  return { created, updated, total: valid.length, errors, warnings };
}
