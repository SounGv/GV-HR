import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { computeOverall, scoreBand, COMPETENCIES } from "@/features/performance/calc";
import type { AccessClaims } from "@/lib/auth/jwt";
import { performanceImportRowSchema } from "./schema";
import type { ImportSummary } from "@/features/employee-import/schema";

type Meta = { ip?: string; userAgent?: string };
const json = (v: unknown) => v as import("@prisma/client").Prisma.InputJsonValue;

/**
 * Bulk-imports simple ad-hoc performance reviews (one row per employee per
 * cycle, fixed 5-competency scorecard) — e.g. migrating historical review
 * data, or entering scores decided in an offline calibration meeting.
 * Upserts by (employee, cycle) so re-uploading a corrected file updates
 * rather than duplicates. This is a bulk HR operation — gated on
 * `performance:approve` (HR-level), not the per-review manager check the
 * single-review endpoint uses.
 */
export async function importPerformanceReviews(
  companyId: string,
  session: AccessClaims,
  rawRows: Record<string, unknown>[],
  meta?: Meta,
): Promise<ImportSummary> {
  const errors: ImportSummary["errors"] = [];
  const warnings: string[] = [];
  const valid: { row: ReturnType<typeof performanceImportRowSchema.parse>; index: number }[] = [];

  rawRows.forEach((raw, i) => {
    const r = raw as Record<string, unknown>;
    const scores = COMPETENCIES.map((name) => r[name]);
    const candidate = {
      employeeCode: r.employeeCode,
      cycle: r.cycle,
      scores,
      strengths: r.strengths,
      improvements: r.improvements,
      summary: r.summary,
    };
    const parsed = performanceImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({ row: i + 1, code: String(r.employeeCode ?? "-"), message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
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

    const competencies = COMPETENCIES.map((name, i) => ({ name, score: r.scores[i] }));
    const overall = computeOverall(competencies);
    const band = scoreBand(overall);

    const existing = await prisma.performanceReview.findFirst({
      where: { companyId, employeeId, cycle: r.cycle, deletedAt: null },
      select: { id: true },
    });

    const data = {
      overallScore: overall,
      band,
      competencies: json(competencies),
      strengths: r.strengths ?? null,
      improvements: r.improvements ?? null,
      summary: r.summary ?? null,
      updatedById: session.sub,
    };

    if (existing) {
      await prisma.performanceReview.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.performanceReview.create({
        data: {
          companyId,
          employeeId,
          reviewerUserId: session.sub,
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
    action: "performance.import",
    entity: "PerformanceReview",
    after: { created, updated, errors: errors.length },
    ...meta,
  });

  return { created, updated, total: valid.length, errors, warnings };
}
