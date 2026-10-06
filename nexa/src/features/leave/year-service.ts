import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { rolloverBalances, yearsProblem, type NewBalance } from "./year-rollover";

type Meta = { ip?: string; userAgent?: string };

export interface RolloverPlan {
  fromYear: number;
  toYear: number;
  carryAnnualCap: number;
  /** DryRun report: nothing is written until the plan is applied. */
  rows_in: number;
  matched: number;
  to_insert: number;
  to_update: number;
  skipped: { already_exists: number; inactive_employee: number };
  null_count: number;
  duplicate_count: number;
  carriedDays: number;
  byType: Record<string, number>;
  sample_diff: { code: string; name: string; type: string; fromTotal: number; fromUsed: number; toTotal: number; carried: number }[];
}

interface PlannedRow extends NewBalance {
  employeeId: string;
}

async function plan(companyId: string, fromYear: number, toYear: number, carryAnnualCap: number) {
  const problem = yearsProblem(fromYear, toYear);
  if (problem) throw BadRequest(problem);
  if (!(carryAnnualCap >= 0 && carryAnnualCap <= 60)) throw BadRequest("จำนวนวันที่ยกยอดได้ต้องอยู่ระหว่าง 0–60");

  const fromRows = await prisma.leaveBalance.findMany({
    where: { companyId, year: fromYear },
    select: {
      employeeId: true,
      type: true,
      totalDays: true,
      usedDays: true,
      totalHours: true,
      employee: { select: { employeeCode: true, firstName: true, lastName: true, status: true, deletedAt: true } },
    },
  });
  const existing = new Set(
    (await prisma.leaveBalance.findMany({ where: { companyId, year: toYear }, select: { employeeId: true, type: true } })).map(
      (b) => `${b.employeeId}|${b.type}`,
    ),
  );

  const byEmployee = new Map<string, typeof fromRows>();
  let inactive = 0;
  for (const r of fromRows) {
    if (r.employee.deletedAt || r.employee.status !== "ACTIVE") {
      inactive++;
      continue;
    }
    byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  }

  const rows: PlannedRow[] = [];
  let alreadyExists = 0;
  const sample: RolloverPlan["sample_diff"] = [];
  for (const [employeeId, prev] of byEmployee) {
    for (const nb of rolloverBalances(prev, carryAnnualCap)) {
      if (existing.has(`${employeeId}|${nb.type}`)) {
        alreadyExists++;
        continue;
      }
      rows.push({ employeeId, ...nb });
      if (sample.length < 8 && (nb.carried > 0 || sample.length < 5)) {
        const p = prev.find((x) => x.type === nb.type)!;
        sample.push({
          code: p.employee.employeeCode,
          name: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
          type: nb.type,
          fromTotal: p.totalDays,
          fromUsed: p.usedDays,
          toTotal: nb.totalDays,
          carried: nb.carried,
        });
      }
    }
  }

  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;

  const report: RolloverPlan = {
    fromYear,
    toYear,
    carryAnnualCap,
    rows_in: fromRows.length,
    matched: byEmployee.size,
    to_insert: rows.length,
    to_update: 0,
    skipped: { already_exists: alreadyExists, inactive_employee: inactive },
    null_count: 0,
    duplicate_count: 0,
    carriedDays: Math.round(rows.reduce((s, r) => s + r.carried, 0) * 10) / 10,
    byType,
    sample_diff: sample,
  };
  return { report, rows };
}

/** DryRun: what setting up `toYear` from `fromYear` would create. Reads only. */
export async function previewRollover(companyId: string, fromYear: number, toYear: number, carryAnnualCap: number) {
  return (await plan(companyId, fromYear, toYear, carryAnnualCap)).report;
}

/**
 * Creates the new year's rows (never touches an existing row, so running it twice is harmless).
 * `expectedInsert` is the count HR saw in the preview: if the data changed since, nothing is written.
 */
export async function applyRollover(
  companyId: string,
  session: AccessClaims,
  input: { fromYear: number; toYear: number; carryAnnualCap: number; expectedInsert: number },
  meta?: Meta,
) {
  const { report, rows } = await plan(companyId, input.fromYear, input.toYear, input.carryAnnualCap);
  if (report.to_insert !== input.expectedInsert) {
    throw BadRequest(`ข้อมูลเปลี่ยนไปหลังดูตัวอย่าง (ตอนนี้จะสร้าง ${report.to_insert} แถว ไม่ใช่ ${input.expectedInsert}) กรุณาดูตัวอย่างใหม่`);
  }
  if (rows.length === 0) return { inserted: 0, report };

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await prisma.leaveBalance.createMany({
      data: chunk.map((r) => ({
        companyId,
        employeeId: r.employeeId,
        year: input.toYear,
        type: r.type,
        totalDays: r.totalDays,
        usedDays: 0,
        totalHours: r.totalHours,
        usedHours: 0,
      })),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "leave.year_rollover",
    entity: "LeaveBalance",
    entityId: String(input.toYear),
    after: { fromYear: input.fromYear, toYear: input.toYear, carryAnnualCap: input.carryAnnualCap, inserted },
    ...meta,
  });
  return { inserted, report };
}
