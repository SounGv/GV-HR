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
  const branches = await prisma.branch.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } });
  const costCenters = await prisma.costCenter.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true } });
  const deptMap = new Map(depts.map((d) => [norm(d.name), d.id]));
  const posMap = new Map(positions.map((p) => [norm(p.title), p.id]));
  const branchMap = new Map(branches.map((b) => [norm(b.name), b.id]));
  const costCenterMap = new Map(costCenters.map((c) => [norm(c.name), c.id]));
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

  // Managers are linked after every row is saved, so a manager listed in the
  // same file (or created by it) resolves just like one already in the system.
  const idByCode = new Map(codeMap);
  const pendingManagers: { code: string; managerCode: string }[] = [];

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
      const lookup = (label: string, value: string | null | undefined, map: Map<string, string>) => {
        if (!value) return undefined;
        const id = map.get(norm(value));
        if (!id) warnings.push(`${r.employeeCode}: ไม่พบ${label} “${value}” (ข้ามการผูก${label})`);
        return id;
      };
      const departmentId = lookup("แผนก", r.department, deptMap);
      const positionId = lookup("ตำแหน่ง", r.position, posMap);
      const branchId = lookup("สาขา", r.branch, branchMap);
      const costCenterId = lookup("ศูนย์ต้นทุน", r.costCenter, costCenterMap);

      // A blank cell (or a name that doesn't match) means "leave this alone" —
      // it used to overwrite the saved value with null, so re-importing a
      // partial sheet silently wiped existing departments, positions and contacts.
      const provided = {
        firstName: r.firstName,
        ...(r.lastName ? { lastName: r.lastName } : {}),
        ...(r.nickname != null ? { nickname: r.nickname } : {}),
        ...(r.email != null ? { email: r.email } : {}),
        ...(r.phone != null ? { phone: r.phone } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(positionId ? { positionId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(costCenterId ? { costCenterId } : {}),
        // hireDate / probationEndDate drive medical-benefit and loan eligibility.
        ...(r.hireDate ? { hireDate: r.hireDate } : {}),
        ...(r.probationEndDate ? { probationEndDate: r.probationEndDate } : {}),
        ...(r.baseSalary != null ? { baseSalary: new Prisma.Decimal(r.baseSalary) } : {}),
        updatedById: session.sub,
      };

      const existingId = codeMap.get(r.employeeCode);
      if (existingId) {
        await tx.employee.update({ where: { id: existingId }, data: provided });
        updated++;
      } else {
        const createdRow = await tx.employee.create({
          data: { companyId, employeeCode: r.employeeCode, lastName: "", ...provided, createdById: session.sub },
          select: { id: true },
        });
        idByCode.set(r.employeeCode, createdRow.id);
        created++;
      }
      if (r.managerCode) pendingManagers.push({ code: r.employeeCode, managerCode: r.managerCode });
    }

    for (const { code, managerCode } of pendingManagers) {
      const employeeId = idByCode.get(code);
      const managerId = idByCode.get(managerCode);
      if (!employeeId) continue;
      if (managerCode === code) {
        warnings.push(`${code}: หัวหน้าเป็นคนเดียวกับพนักงาน (ข้ามการผูกหัวหน้า)`);
      } else if (!managerId) {
        warnings.push(`${code}: ไม่พบรหัสหัวหน้า “${managerCode}” (ข้ามการผูกหัวหน้า)`);
      } else {
        await tx.employee.update({ where: { id: employeeId }, data: { managerId } });
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
