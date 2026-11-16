/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getRoundMatrix } from "@/features/appraisal-round/service";

// The tracking page's date and score per rater, against the real database. Read-only: fails if any row count changed.
// Checks HR sees date and score (including the 66.67 one rater gave in the October up round), and a manager sees neither.
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = { a: await real.appraisalAssignment.count(), p: await real.appraisalParticipant.count(), l: await real.auditLog.count() };
  const lines: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      lines.push(`PASS  ${name}`);
    } catch (e: any) {
      lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    }
  };
  const round = await real.appraisalRound.findFirst({ where: { companyId: COMPANY, deletedAt: null, name: { contains: "ลูกน้องประเมินหัวหน้า (นำเข้า" } }, select: { id: true } });
  assert.ok(round, "imported up round exists");
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const claims = (perms: string[], employeeId?: string) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms, employeeId }) as any;

  const hr: any[] = (await getRoundMatrix(COMPANY, round!.id, claims(["campaign:update", "campaign:manage", "campaign:read"]))) as any;
  await check("HR sees the date and the score of every submitted sheet", async () => {
    const sheets = hr.flatMap((r) => r.assignments);
    assert.ok(sheets.length > 100);
    assert.ok(sheets.every((a) => a.status === "SUBMITTED" && a.submittedAt && (a.percent === 100 || a.percent === 66.67)));
  });
  await check("one rater gave 66.67 to ชัยณรงค์ on 2026-11-03 (Favpo shows the same)", async () => {
    const row = hr.find((r) => r.name.startsWith("ชัยณรงค์"));
    assert.ok(row);
    const low = row.assignments.filter((a: any) => a.percent === 66.67);
    assert.equal(low.length, 1);
    assert.equal(low[0].submittedAt, "2026-11-03");
  });
  const boss = await real.employee.findFirst({ where: { companyId: COMPANY, deletedAt: null, reports: { some: {} } }, select: { id: true } }).catch(() => null);
  await check("a manager sees who has finished but never a date or a score", async () => {
    const mgr = boss ?? (await real.employee.findFirst({ where: { companyId: COMPANY, deletedAt: null, managerId: { not: null } }, select: { managerId: true } }).then((e) => (e ? { id: e.managerId! } : null)));
    assert.ok(mgr, "a manager exists");
    const rows: any[] = (await getRoundMatrix(COMPANY, round!.id, claims(["campaign:manage", "campaign:read"], mgr!.id))) as any;
    for (const a of rows.flatMap((r) => r.assignments)) {
      assert.equal(a.submittedAt, null);
      assert.equal(a.percent, null);
    }
    lines.push(`      (manager view: ${rows.length} people)`);
  });
  const after = { a: await real.appraisalAssignment.count(), p: await real.appraisalParticipant.count(), l: await real.auditLog.count() };
  await check("nothing was written", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
