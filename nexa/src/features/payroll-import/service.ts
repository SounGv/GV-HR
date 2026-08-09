import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { updatePayrollAdjustments } from "@/features/payroll/service";
import { payrollImportRowSchema } from "./schema";
import type { ImportSummary } from "@/features/employee-import/schema";

type Meta = { ip?: string; userAgent?: string };

/**
 * Bulk-imports payroll adjustments (bonus/allowance/advance/other line items)
 * across many employees for a period in one file — reuses the exact same
 * recompute logic as the single-payslip "extra items" editor (Phase 6), just
 * grouping CSV rows by (employee, period) first so multiple line items for
 * the same payslip apply together instead of overwriting each other.
 */
export async function importPayrollAdjustments(
  companyId: string,
  session: AccessClaims,
  rawRows: Record<string, unknown>[],
  meta?: Meta,
): Promise<ImportSummary> {
  const errors: ImportSummary["errors"] = [];
  const warnings: string[] = [];

  type Group = { employeeCode: string; period: string; earnings: { label: string; amount: number }[]; deductions: { label: string; amount: number }[] };
  const groups = new Map<string, Group>();

  rawRows.forEach((raw, i) => {
    const parsed = payrollImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 1, code: String(raw.employeeCode ?? "-"), message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
      return;
    }
    const r = parsed.data;
    const key = `${r.employeeCode}|${r.period}`;
    const group = groups.get(key) ?? { employeeCode: r.employeeCode, period: r.period, earnings: [], deductions: [] };
    (r.type === "earning" ? group.earnings : group.deductions).push({ label: r.label, amount: r.amount });
    groups.set(key, group);
  });

  const codes = [...new Set([...groups.values()].map((g) => g.employeeCode))];
  const employees = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: codes }, deletedAt: null },
    select: { id: true, employeeCode: true },
  });
  const empByCode = new Map(employees.map((e) => [e.employeeCode, e.id]));

  let updated = 0;
  for (const g of groups.values()) {
    const employeeId = empByCode.get(g.employeeCode);
    if (!employeeId) {
      errors.push({ row: 0, code: g.employeeCode, message: "ไม่พบรหัสพนักงานนี้ในระบบ" });
      continue;
    }
    const record = await prisma.payrollRecord.findFirst({
      where: { companyId, employeeId, period: g.period, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!record) {
      errors.push({ row: 0, code: g.employeeCode, message: `ยังไม่ได้ออกรอบเงินเดือนงวด ${g.period} ให้พนักงานคนนี้ — กรุณาออกรอบก่อน` });
      continue;
    }
    if (record.status === "PAID") {
      warnings.push(`${g.employeeCode} (${g.period}): จ่ายแล้ว ข้ามการนำเข้ารายการเพิ่มเติม`);
      continue;
    }
    await updatePayrollAdjustments(
      companyId,
      session,
      record.id,
      { extraEarnings: g.earnings, extraDeductions: g.deductions },
      meta,
    );
    updated++;
  }

  return { created: 0, updated, total: groups.size, errors, warnings };
}
