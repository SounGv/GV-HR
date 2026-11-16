/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { loadTodayAttendance } from "@/features/attendance-status/service";

// Read-only: what the home page shows on a Saturday, and the leave note beside a person who came in. Fails if any row count changed.
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = { l: await real.leaveRequest.count(), a: await real.attendanceRecord.count() };
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
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["dashboard:read", "report:read", "attendance:read", "employee:read", "employee:update"] } as any;

  await check("Saturday 14 Nov 2026: the page reports what happened, not a blank", async () => {
    const t = await loadTodayAttendance(COMPANY, hr, undefined, new Date("2026-11-14T10:00:00Z"));
    assert.equal(t.isWorkingDay, false);
    assert.ok(t.weekendActivity, "no Saturday activity");
    assert.equal(t.counts.ABSENT, 0, "nobody is counted absent on a Saturday");
    const scans = await real.attendanceRecord.count({ where: { companyId: COMPANY, deletedAt: null, workDate: new Date("2026-11-14T00:00:00Z"), clockInAt: { not: null } } });
    assert.ok(t.weekendActivity!.scanned <= scans && t.weekendActivity!.scanned > 0, `scanned ${t.weekendActivity!.scanned} vs records ${scans}`);
    lines.push(`      (Saturday 14 Nov: scanned ${t.weekendActivity!.scanned}, late ${t.weekendActivity!.late}, on leave ${t.weekendActivity!.onLeave})`);
  });
  await check("Sunday 15 Nov 2026 stays a plain non-working day", async () => {
    const t = await loadTodayAttendance(COMPANY, hr, undefined, new Date("2026-11-15T10:00:00Z"));
    assert.equal(t.isWorkingDay, false);
    assert.ok(!t.weekendActivity);
  });
  await check("a normal Monday is unchanged: 16 Nov counts add up", async () => {
    const t = await loadTodayAttendance(COMPANY, hr);
    assert.equal(t.isWorkingDay, true);
    const sum = t.counts.NORMAL + t.counts.LATE + t.counts.ABSENT + t.counts.ON_LEAVE + t.counts.LEAVE_PENDING + t.counts.NOT_YET;
    assert.equal(sum, t.total);
  });
  await check("the person on morning hourly leave carries a leave note and is not late", async () => {
    const t = await loadTodayAttendance(COMPANY, hr);
    const p = t.people.find((x) => x.code === "1047");
    assert.ok(p);
    assert.notEqual(p!.status, "LATE");
    assert.ok(p!.leaveNote && p!.leaveNote.includes("09:00-10:00"), `note: ${p!.leaveNote}`);
    lines.push(`      (1047 today: ${p!.status}, note "${p!.leaveNote}")`);
  });
  await check("the leave tab count is full-day leave plus people who came in with an hour or half day of leave", async () => {
    const t = await loadTodayAttendance(COMPANY, hr);
    const partial = t.people.filter((p) => p.status !== "ON_LEAVE" && p.leaveNote).length;
    assert.ok(partial >= 1, "1047 should be listed");
    assert.ok(t.people.some((p) => p.code === "1047" && p.leaveNote));
    lines.push(`      (leave tab today: ${t.counts.ON_LEAVE} all day + ${partial} part of the day = ${t.counts.ON_LEAVE + partial})`);
  });
  const after = { l: await real.leaveRequest.count(), a: await real.attendanceRecord.count() };
  await check("nothing was written", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
