import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { teamScopeFilter } from "@/features/employee/service";
import { getReport } from "@/features/report/service";
import { bandFor, kpiScore, profileProblems, type Indicator, type KpiBand, type KpiPart } from "./rules";

type Meta = { ip?: string; userAgent?: string };

export interface KpiProfileView {
  id: string;
  name: string;
  indicators: Indicator[];
  bands: KpiBand[];
  updatedAt: string;
}

const asIndicators = (v: Prisma.JsonValue): Indicator[] =>
  Array.isArray(v)
    ? (v as unknown as Indicator[]).filter((i) => i && typeof i.metric === "string" && Array.isArray(i.steps))
    : [];
const asBands = (v: Prisma.JsonValue | null): KpiBand[] => (Array.isArray(v) ? (v as unknown as KpiBand[]) : []);

const view = (p: { id: string; name: string; indicators: Prisma.JsonValue; bands: Prisma.JsonValue | null; updatedAt: Date }): KpiProfileView => ({
  id: p.id,
  name: p.name,
  indicators: asIndicators(p.indicators),
  bands: asBands(p.bands),
  updatedAt: p.updatedAt.toISOString(),
});

export async function listProfiles(companyId: string): Promise<KpiProfileView[]> {
  const rows = await prisma.appraisalKpiProfile.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true, indicators: true, bands: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(view);
}

export async function saveProfile(
  companyId: string,
  session: AccessClaims,
  input: { id?: string; name: string; indicators: Indicator[]; bands: KpiBand[] },
  meta?: Meta,
): Promise<KpiProfileView> {
  const problems = profileProblems(input.indicators, input.bands);
  if (problems.length) throw BadRequest(problems.join(" · "));
  const data = {
    name: input.name,
    indicators: input.indicators as unknown as Prisma.InputJsonValue,
    bands: input.bands as unknown as Prisma.InputJsonValue,
    updatedById: session.sub,
  };
  let row;
  if (input.id) {
    const existing = await prisma.appraisalKpiProfile.findFirst({ where: { id: input.id, companyId, deletedAt: null }, select: { id: true } });
    if (!existing) throw NotFound("ไม่พบโปรไฟล์ KPI");
    row = await prisma.appraisalKpiProfile.update({ where: { id: input.id }, data, select: { id: true, name: true, indicators: true, bands: true, updatedAt: true } });
  } else {
    row = await prisma.appraisalKpiProfile.create({
      data: { companyId, createdById: session.sub, ...data },
      select: { id: true, name: true, indicators: true, bands: true, updatedAt: true },
    });
  }
  await writeAudit({ companyId, actorUserId: session.sub, action: input.id ? "appraisal_kpi.update" : "appraisal_kpi.create", entity: "AppraisalKpiProfile", entityId: row.id, after: { name: input.name }, ...meta });
  return view(row);
}

export async function deleteProfile(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.appraisalKpiProfile.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, name: true } });
  if (!existing) throw NotFound("ไม่พบโปรไฟล์ KPI");
  await prisma.appraisalKpiProfile.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_kpi.delete", entity: "AppraisalKpiProfile", entityId: id, before: { name: existing.name }, ...meta });
}

export interface KpiRunRow {
  code: string;
  name: string;
  score: number;
  band: { label: string; tone: string } | null;
  parts: KpiPart[];
}

/**
 * Scores everyone in the caller's team scope for a period from the attendance summary the system already keeps.
 * Read-only: nothing is stored and nothing is added to any appraisal score.
 */
export async function runProfile(companyId: string, session: AccessClaims, id: string, from: string, to: string): Promise<{ rows: KpiRunRow[]; period: string }> {
  const profile = await prisma.appraisalKpiProfile.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true, indicators: true, bands: true, updatedAt: true },
  });
  if (!profile) throw NotFound("ไม่พบโปรไฟล์ KPI");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw BadRequest("ช่วงวันที่ไม่ถูกต้อง");

  const { indicators, bands } = view(profile);
  const report = await getReport(companyId, { type: "attendance", from, to, employeeWhere: teamScopeFilter(session) ?? undefined });
  const rows: KpiRunRow[] = report.rows.map((r) => {
    const values: Record<string, number> = {};
    for (const i of indicators) values[i.metric] = Number(r[i.metric] ?? 0) || 0;
    const res = kpiScore(indicators, values);
    const band = bandFor(res.score, bands);
    return { code: String(r.code), name: String(r.name), score: res.score, band: band ? { label: band.label, tone: band.tone } : null, parts: res.parts };
  });
  rows.sort((a, b) => a.score - b.score || a.code.localeCompare(b.code));
  return { rows, period: `${from} ถึง ${to}` };
}
