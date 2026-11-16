/* eslint-disable @typescript-eslint/no-explicit-any -- read-only check against the real data */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getDashboardSummary } from "@/features/dashboard/service";
import { listEmployees } from "@/features/employee/service";
import { employeeListQuerySchema } from "@/features/employee/schema";
import { loadAttendanceWatch, loadEmployeeAttendanceSummary } from "@/features/attendance-status/service";
import { loadEvaluationOverview } from "@/features/dashboard-people/evaluation-overview";
import { getRoundResults } from "@/features/appraisal-round/results-service";
import { bandKeyOf } from "@/features/dashboard-people/evaluation-rules";

// Every link added to the home page opens the page it should and the number behind the click equals the number on the home page.
// Read-only (fails if any row count changed). Uses the same service functions the linked pages and their APIs call.
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = { e: await real.employee.count(), p: await real.appraisalParticipant.count(), a: await real.attendanceRecord.count() };
  const lines: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      lines.push(`PASS  ${name}`);
    } catch (e: any) {
      lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    }
  };
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const perms = ["leave:approve", "overtime:approve", "attendance:approve", "attendance:manage", "dashboard:read", "report:read", "employee:read", "employee:update", "campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms } as any;
  const list = (q: Record<string, unknown>) => listEmployees(COMPANY, employeeListQuerySchema.parse({ pageSize: 100, ...q }), hr);

  const summary: any = await getDashboardSummary(COMPANY);
  await check("the headcount strip cell opens the list on working people and it shows the same number", async () => {
    const r = await list({ status: "ACTIVE" });
    assert.equal(r.total, summary.headcount);
  });
  for (const t of summary.byEmploymentType) {
    await check(`employment type ${t.type}: the list behind the row has ${t.count} people, as on the home page`, async () => {
      const r = await list({ status: "ACTIVE", employmentType: t.type });
      assert.equal(r.total, t.count);
    });
  }
  let deptChecked = 0;
  for (const d of summary.byDepartment) {
    if (!d.id) continue;
    deptChecked++;
    await check(`department row "${d.name}": the filtered list has ${d.count} people, as on the home page`, async () => {
      assert.ok(d.id, "no id on the row");
      const r = await list({ status: "ACTIVE", departmentId: [d.id] });
      assert.equal(r.total, d.count);
    });
  }
  await check("every department row that has people carries an id (so it can be a link)", async () => {
    const without = summary.byDepartment.filter((d: any) => !d.id && d.name !== "ไม่ระบุ");
    assert.equal(without.length, 0, JSON.stringify(without));
    assert.ok(deptChecked > 0);
  });

  const ev: any = await loadEvaluationOverview(COMPANY, hr);
  for (const b of ev.resultsBoard) {
    const rows: any[] = (await getRoundResults(COMPANY, b.roundId, hr)) as any;
    await check(`score rows of "${b.roundName.slice(0, 40)}": each band's list has the same people as the home page count`, async () => {
      assert.ok(Array.isArray(rows) && rows.length === b.total, `rows ${rows.length} vs total ${b.total}`);
      for (const s of b.spread) {
        const n = rows.filter((r) => r.scorePercent !== null && bandKeyOf(r.scorePercent) === s.key).length;
        assert.equal(n, s.count, `band ${s.label}: list ${n} vs home ${s.count}`);
      }
      assert.equal(b.spread.reduce((a: number, s: any) => a + s.count, 0), b.total);
    });
    await check(`gauge link of "${b.roundName.slice(0, 40)}" is the round's results page`, async () => assert.equal(b.href, `/appraisal/rounds/${b.roundId}`));
  }

  const watch: any = await loadAttendanceWatch(COMPANY, hr);
  for (const p of watch.people.slice(0, 6)) {
    await check(`watch row ${p.code}: the side panel it opens shows the same late and absent days as the row`, async () => {
      const s: any = await loadEmployeeAttendanceSummary(COMPANY, hr, p.code);
      assert.ok(s, "panel returns nothing for this person");
      assert.equal(s.late, p.late);
      assert.equal(s.absent, p.absent);
    });
  }
  const deptIds = new Map((await real.department.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { id: true, name: true } })).map((d) => [d.name, d.id]));
  for (const d of watch.departments.slice(0, 4)) {
    await check(`department watch row "${d.department}": has an id, and the list behind it holds only that department with the same late and absent totals`, async () => {
      assert.equal(d.departmentId, deptIds.get(d.department) ?? null);
      assert.ok(d.departmentId, "no id");
      const w: any = await loadAttendanceWatch(COMPANY, hr, [d.departmentId]);
      assert.ok(w.people.every((p: any) => p.department === d.department), "someone from another department");
      const same = w.departments.find((x: any) => x.department === d.department);
      assert.ok(same, "department missing in the narrowed list");
      assert.equal(same.late, d.late);
      assert.equal(same.absent, d.absent);
    });
  }

  const after = { e: await real.employee.count(), p: await real.appraisalParticipant.count(), a: await real.attendanceRecord.count() };
  await check("nothing was written", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
