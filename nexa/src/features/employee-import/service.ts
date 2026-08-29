import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
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
  // Sequential, not Promise.all — connection_limit=1.
  const depts = await prisma.department.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } });
  const positions = await prisma.position.findMany({ where: { companyId, deletedAt: null }, select: { id: true, title: true } });
  // Includes soft-deleted rows too — employeeCode uniqueness is enforced
  // at the DB level across ALL rows regardless of deletedAt (see below).
  const allEmployees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, employeeCode: true, deletedAt: true } });
  const deptMap = new Map(depts.map((d) => [norm(d.name), d.id]));
  const posMap = new Map(positions.map((p) => [norm(p.title), p.id]));
  const codeMap = new Map(allEmployees.filter((e) => !e.deletedAt).map((e) => [e.employeeCode, e.id]));
  // employeeCode is only unique per (companyId, employeeCode) at the DB
  // level, not scoped by deletedAt — a code that already belongs to a
  // soft-deleted employee would otherwise pass this map's "not existing"
  // check, attempt tx.employee.create(), throw P2002 mid-loop, and roll back
  // every row already applied earlier in the same import batch.
  const takenBySoftDeleted = new Set(allEmployees.filter((e) => e.deletedAt).map((e) => e.employeeCode));

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
  // The route only requires `employee:create` — without this, a role granted
  // just that permission could bulk-overwrite existing employees' salary/
  // contact data via a CSV row whose employeeCode matches someone already in
  // the system, despite being correctly blocked from that via a direct
  // PATCH /api/employees/[id] (which requires `employee:update`).
  const canUpdate = can(session.perms, "employee:update");

  await prisma.$transaction(async (tx) => {
    for (const { row: r, index } of valid) {
      if (codeMap.has(r.employeeCode) && !canUpdate) {
        errors.push({ row: index, code: r.employeeCode, message: "มีพนักงานรหัสนี้อยู่แล้ว และคุณไม่มีสิทธิ์แก้ไขข้อมูลพนักงาน" });
        continue;
      }
      if (!codeMap.has(r.employeeCode) && takenBySoftDeleted.has(r.employeeCode)) {
        errors.push({ row: index, code: r.employeeCode, message: "รหัสพนักงานนี้เคยถูกใช้กับพนักงานที่ถูกลบไปแล้ว กรุณาใช้รหัสอื่น" });
        continue;
      }
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
