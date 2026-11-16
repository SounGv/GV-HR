/* eslint-disable @typescript-eslint/no-explicit-any -- read-only check */
// Read-only: the person result page shows who wrote each comment to HR only. Compares the service output with the sheets in the database.
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getParticipantResult } from "@/features/appraisal-round/service";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  g.__tx = real;
  const lines: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); lines.push(`PASS  ${name}`); } catch (e: any) { lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); }
  };
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const mk = (perms: string[]) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms }) as any;
  const hr = mk(["campaign:update", "campaign:approve", "campaign:manage", "campaign:read", "campaign:create", "employee:read"]);
  const top = await real.employee.groupBy({ by: ["managerId"], where: { companyId: COMPANY, deletedAt: null, managerId: { not: null } }, _count: { _all: true }, orderBy: { _count: { managerId: "desc" } }, take: 1 });
  const mgr = { ...mk(["campaign:manage", "campaign:read"]), employeeId: top[0]!.managerId } as any;
  let mgrSeen = 0;
  const rounds = await real.appraisalRound.findMany({ where: { companyId: COMPANY, deletedAt: null, isTemplate: false, name: { contains: "นำเข้าจาก Favpo" } }, select: { id: true, name: true, participants: { select: { id: true, assignments: { select: { id: true, status: true, answers: true, rater: { select: { firstName: true } } } } } } } });
  const textQ = await real.appraisalQuestion.findFirst({ where: { answerType: "PARAGRAPH", form: { name: "แบบประเมิน 2026 New (นำเข้าจาก Favpo)" } }, select: { id: true } });
  for (const r of rounds) {
    const expected = r.participants.reduce((n, p) => n + p.assignments.filter((a) => a.status === "SUBMITTED" && (Array.isArray(a.answers) ? (a.answers as any[]) : []).some((x) => x.questionId === textQ?.id && typeof x.value === "string" && x.value.trim())).length, 0);
    let got = 0, nonHrLeak = 0, nameBad = 0, linkBad = 0;
    for (const p of r.participants) {
      const h = await getParticipantResult(COMPANY, r.id, p.id, hr);
      assert.ok(h.namedComments, "HR gets named comments");
      got += h.namedComments!.length;
      for (const c of h.namedComments!) {
        const a = p.assignments.find((x) => x.id === c.assignmentId);
        if (!a) linkBad++;
        else if (!c.raterName.startsWith(a.rater.firstName)) nameBad++;
      }
      const m = await getParticipantResult(COMPANY, r.id, p.id, mgr).catch(() => null);
      if (m) { mgrSeen++; if (m.namedComments !== null || JSON.stringify(m).includes("raterName")) nonHrLeak++; }
    }
    await check(`${r.name.slice(0, 34)}: named comments ${got} = sheets with a comment ${expected}`, async () => assert.equal(got, expected));
    await check(`${r.name.slice(0, 34)}: every comment links to its own sheet and rater name matches (bad ${linkBad}/${nameBad})`, async () => assert.equal(linkBad + nameBad, 0));
    await check(`${r.name.slice(0, 34)}: non-HR view carries no names (leaks ${nonHrLeak}, viewed so far ${mgrSeen})`, async () => assert.equal(nonHrLeak, 0));
  }
  console.log(lines.join("\n"));
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
