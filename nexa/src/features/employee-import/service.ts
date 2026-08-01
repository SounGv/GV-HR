import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { importRowSchema, type ImportSummary } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const norm = (s: string) => s.trim().toLowerCase();

export async function importEmployees(
  companyId: string,
  rawRows: Record<string, unknown>[],
  session: SessionUser,
  meta?: Meta,
): Promise<ImportSummary> {
  const [depts, positions, existing] = await Promise.all([
    prisma.department.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.position.findMany({ where: { companyId, deletedAt: null }, select: { id: true, title: true } }),
    prisma.employee.findMany({ where: { companyId, deletedAt: null }, select: { id: true, employeeCode: true } }),
  ]);
  const deptMap = new Map(depts.map((d) => [norm(d.name), d.id]));
  const posMap = new Map(positions.map((p) => [norm(p.title), p.id]));
  const codeMap = new Map(existing.map((e) => [e.employeeCode, e.id]));

  const errors: ImportSummary["errors"] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const valid: { row: import("./schema").ImportRow; index: number }[] = [];

  rawRows.forEach((raw, i) => {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        row: i + 1,
        code: String(raw.employeeCode ?? "-"),
        message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      });
      return;
    }
    const r = parsed.data;
    if (seen.has(r.employeeCode)) {
      errors.push({ row: i + 1, code: r.employeeCode, message: "รหัสพนักงานซ้ำในไฟล์" });
      return;
    }
    seen.add(r.employeeCode);
    valid.push({ row: r, index: i + 1 });
  });

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const { row: r } of valid) {
      const departmentId = r.department ? (deptMap.get(norm(r.department)) ?? null) : null;
      const positionId = r.position ? (posMap.get(norm(r.position)) ?? null) : null;
      if (r.department && !departmentId) warnings.push(`${r.employeeCode}: ไม่พบแผนก “${r.department}” (ข้ามการผูกแผนก)`);
      if (r.position && !positionId) warnings.push(`${r.employeeCode}: ไม่พบตำแหน่ง “${r.position}” (ข้ามการผูกตำแหน่ง)`);

      const common = {
        firstName: r.firstName,
        lastName: r.lastName ?? "",
        nickname: r.nickname ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        departmentId,
        positionId,
        ...(r.baseSalary != null ? { baseSalary: new Prisma.Decimal(r.baseSalary) } : {}),
        updatedById: session.sub,
      };

      const existingId = codeMap.get(r.employeeCode);
      if (existingId) {
        await tx.employee.update({ where: { id: existingId }, data: common });
        updated++;
      } else {
        await tx.employee.create({
          data: { companyId, employeeCode: r.employeeCode, ...common, createdById: session.sub },
        });
        created++;
      }
    }
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee.import",
    entity: "Employee",
    after: { created, updated, errors: errors.length },
    ...meta,
  });

  return { created, updated, total: valid.length, errors, warnings };
}
