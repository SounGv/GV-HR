/* eslint-disable @typescript-eslint/no-explicit-any -- read-only */
import { prisma as real } from "@real/prisma";
(async () => {
  const rounds = await real.appraisalRound.findMany({ where: { deletedAt: null }, select: { id: true, name: true, status: true, isTemplate: true, startDate: true, endDate: true, createdAt: true, formId: true, _count: { select: { participants: true } } }, orderBy: { createdAt: "asc" } });
  console.table(rounds.map((r) => ({ id: r.id.slice(0, 8), name: r.name.slice(0, 52), status: r.status, template: r.isTemplate, period: `${r.startDate?.toISOString().slice(0, 10) ?? "-"}..${r.endDate?.toISOString().slice(0, 10) ?? "-"}`, people: r._count.participants, created: r.createdAt.toISOString().slice(0, 16) })));
  const byName = new Map<string, number>();
  for (const r of rounds) byName.set(r.name, (byName.get(r.name) ?? 0) + 1);
  console.log("rounds sharing a name:", [...byName].filter(([, n]) => n > 1).length);
  const byPeriodType = new Map<string, number>();
  for (const r of rounds.filter((x) => !x.isTemplate)) { const k = `${r.startDate?.toISOString().slice(0, 10)}|${r.name.includes("ลูกน้องประเมินหัวหน้า") ? "up" : "down"}`; byPeriodType.set(k, (byPeriodType.get(k) ?? 0) + 1); }
  console.log("same period and direction twice:", [...byPeriodType].filter(([, n]) => n > 1).length);
  const dupPart = await real.$queryRawUnsafe<any[]>(`SELECT "roundId","employeeId",COUNT(*)::int c FROM appraisal_participants GROUP BY 1,2 HAVING COUNT(*)>1`);
  const dupSheet = await real.$queryRawUnsafe<any[]>(`SELECT "participantId","raterEmployeeId","raterType",COUNT(*)::int c FROM appraisal_assignments GROUP BY 1,2,3 HAVING COUNT(*)>1`);
  console.log("duplicate people in one round:", dupPart.length, "| duplicate sheets (same rater, same person):", dupSheet.length);
  const imports = await real.auditLog.findMany({ where: { action: { startsWith: "appraisal_round.import_favpo" } }, select: { action: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  console.log("import runs recorded:", imports.map((i) => `${i.action}@${i.createdAt.toISOString().slice(0, 16)}`).join(" | "));
  const sameEmployeeTwice = await real.$queryRawUnsafe<any[]>(`SELECT r.name, p."employeeId", COUNT(*)::int c FROM appraisal_participants p JOIN appraisal_rounds r ON r.id=p."roundId" WHERE r."deletedAt" IS NULL AND r."isTemplate"=false GROUP BY 1,2 HAVING COUNT(*)>1`);
  console.log("a person twice in rounds of the same name:", sameEmployeeTwice.length);
  await real.$disconnect();
})();
