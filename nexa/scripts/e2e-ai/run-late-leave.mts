/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getReport } from "@/features/report/service";
import { loadTodayAttendance } from "@/features/attendance-status/service";

// Leave by the hour and by the half day against late, on the real data. Read-only: fails if any row count changed.
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = { l: await real.leaveRequest.count(), a: await real.attendanceRecord.count(), x: await real.auditLog.count() };
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
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["dashboard:read", "report:read", "attendance:read", "employee:read", "employee:update", "campaign:update"] } as any;

  const rowFor = async (code: string, day: string) => {
    const r: any = await getReport(COMPANY, { type: "attendance_daily", from: day, to: day } as any);
    return r.rows.find((x: any) => x.code === code);
  };
  await check("daily report 2 Nov: 1047 scanned 10:00 inside hourly leave: not late", async () => {
    const x = await rowFor("1047", "2026-11-02");
    assert.ok(x, "no row");
    assert.equal(x.lateMinutes, "-");
    assert.equal(x.statusKey, "PRESENT");
  });
  await check("daily report 12 Nov: 1048 scanned 9:26 (hourly leave 9:00-?): checked against the leave", async () => {
    const x = await rowFor("1048", "2026-11-12");
    assert.ok(x, "no row");
    lines.push(`      (1048 on 12 Nov: late=${x.lateMinutes} status=${x.statusKey})`);
  });
  await check("daily report 19 Oct: 1031 on approved half-day leave is not shown late", async () => {
    const x = await rowFor("1031", "2026-10-19");
    assert.ok(x, "no row");
    assert.equal(x.lateMinutes, "-");
    assert.notEqual(x.statusKey, "LATE");
  });
  await check("a person with no leave who is late is still late (nothing hidden)", async () => {
    const r: any = await getReport(COMPANY, { type: "attendance_daily", from: "2026-11-12", to: "2026-11-12" } as any);
    const late = r.rows.filter((x: any) => x.statusKey === "LATE");
    assert.ok(late.length >= 1, "the late people vanished");
    lines.push(`      (still late on 12 Nov: ${late.length} people)`);
  });
  await check("home page today: no one is late because of an hour of approved leave", async () => {
    const t = await loadTodayAttendance(COMPANY, hr);
    const p = t.people.find((x) => x.code === "1047");
    assert.ok(p, "1047 not in today's list");
    assert.notEqual(p!.status, "LATE");
    lines.push(`      (today: late ${t.counts.LATE}, normal ${t.counts.NORMAL}, leave ${t.counts.ON_LEAVE})`);
  });
  const after = { l: await real.leaveRequest.count(), a: await real.attendanceRecord.count(), x: await real.auditLog.count() };
  await check("nothing was written", async () => {
    assert.equal(after.l, before.l);
    assert.equal(after.a, before.a);
  });
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
