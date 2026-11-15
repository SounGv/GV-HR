import { prisma } from "@/lib/prisma";
import { faces } from "@/lib/avatar-server";
import type { ReportResult } from "./types";

/** Keys added to a report row for drawing the person's picture. They are not columns, so CSV, Excel and PDF never include them. */
export const FACE_KEYS = { id: "_empId", avatar: "_avatar", gender: "_gender" } as const;

/**
 * Adds each person's id, photo address and gender to the report rows that carry an employee code (`code`), so the name
 * cell can show their own picture. Rows without a code (department summaries) are left alone.
 */
export async function attachFaces(companyId: string, result: ReportResult): Promise<ReportResult> {
  const codes = [...new Set(result.rows.map((r) => r.code).filter((c): c is string => typeof c === "string" && c !== ""))];
  if (codes.length === 0) return result;
  const people = await prisma.employee.findMany({ where: { companyId, employeeCode: { in: codes } }, select: { id: true, employeeCode: true } });
  const idByCode = new Map(people.map((p) => [p.employeeCode, p.id]));
  const face = await faces(people.map((p) => p.id));
  for (const row of result.rows) {
    const id = typeof row.code === "string" ? idByCode.get(row.code) : undefined;
    if (!id) continue;
    row[FACE_KEYS.id] = id;
    row[FACE_KEYS.gender] = face.get(id)?.gender ?? "";
    row[FACE_KEYS.avatar] = face.get(id)?.avatarUrl ?? "";
  }
  return result;
}
