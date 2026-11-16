/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getReport } from "@/features/report/service";
import { loadAttendanceWatch, loadTodayAttendance } from "@/features/attendance-status/service";

// A person who asked for leave that nobody has answered yet is "waiting", not absent. Runs inside one transaction that is always
// rolled back, on the most recent past working day that has someone absent (read at 14:00), and fails if any row count changed afterwards.
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const isoOf = (thai: string) => { const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(thai); const i = MON.indexOf(m?.[2] ?? ""); return m && i >= 0 ? `${Number(m[3]) - 543}-${String(i + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : ""; };
const g = globalThis as any;
class Rollback extends Error {}

(async () => {
  const snap = async () => ({ l: await real.leaveRequest.count(), a: await real.attendanceRecord.count(), x: await real.auditLog.count(), n: await real.notification.count() });
  const before = await snap();
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
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["leave:approve", "overtime:approve", "attendance:approve", "attendance:manage", "dashboard:read", "report:read", "employee:read", "employee:update"] } as any;
  const todayIso = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const fromIso = new Date(Date.now() + 7 * 3600_000 - 30 * 86_400_000).toISOString().slice(0, 10);
  const rep0: any = await getReport(COMPANY, { type: "attendance_daily", from: fromIso, to: todayIso } as any);
  const DAY = rep0.rows.filter((r: any) => r.statusKey === "ABSENT").map((r: any) => isoOf(r.date)).filter((d: string) => d && d < todayIso).sort().pop() as string;
  assert.ok(DAY, "no past day with an absent person in the last 30 days");
  const AS_OF = new Date(`${DAY}T07:00:00Z`);
  const dayDate = new Date(`${DAY}T00:00:00Z`);

  const body = async (tx: any) => {
    g.__tx = tx;
    const base: any = await loadTodayAttendance(COMPANY, hr, undefined, AS_OF);
    const absent = base.people.find((p: any) => p.status === "ABSENT");
    const normal = base.people.find((p: any) => p.status === "NORMAL" && p.clockIn);
    assert.ok(absent, "no absent person on the test day");
    assert.ok(normal, "no scanned person on the test day");
    lines.push(`      (test day ${DAY} 14:00: absent ${base.counts.ABSENT}, pending ${base.counts.LEAVE_PENDING}, people ${base.total})`);
    const mk = (employeeId: string, over: Record<string, unknown> = {}) =>
      tx.leaveRequest.create({ data: { companyId: COMPANY, employeeId, type: "SICK", startDate: dayDate, endDate: dayDate, days: 1, status: "PENDING", ...over } });
    const statusOf = async (code: string) => ((await loadTodayAttendance(COMPANY, hr, undefined, AS_OF)) as any).people.find((p: any) => p.code === code);

    const req = await mk(absent.employeeId);
    await check("a waiting full-day request turns absent into LEAVE_PENDING, with a note saying when it was filed", async () => {
      const t: any = await loadTodayAttendance(COMPANY, hr, undefined, AS_OF);
      const p = t.people.find((x: any) => x.code === absent.code);
      assert.equal(p.status, "LEAVE_PENDING");
      assert.equal(t.counts.LEAVE_PENDING, base.counts.LEAVE_PENDING + 1);
      assert.equal(t.counts.ABSENT, base.counts.ABSENT - 1);
      assert.ok(p.pendingLeaveNote?.includes("ลาป่วยทั้งวัน") && p.pendingLeaveNote.includes("รอหัวหน้าอนุมัติ"), String(p.pendingLeaveNote));
      lines.push(`      (note: ${p.pendingLeaveNote})`);
    });
    await check("the counts still add up to the people checked", async () => {
      const t: any = await loadTodayAttendance(COMPANY, hr, undefined, AS_OF);
      const c = t.counts;
      assert.equal(c.NORMAL + c.LATE + c.ABSENT + c.ON_LEAVE + c.LEAVE_PENDING + c.NOT_YET, t.total);
    });
    await check("the daily report shows the same person as 'ลา รออนุมัติ', not as absent", async () => {
      const r: any = await getReport(COMPANY, { type: "attendance_daily", from: DAY, to: DAY } as any);
      const row = r.rows.find((x: any) => x.code === absent.code);
      assert.ok(row, "no row");
      assert.equal(row.statusKey, "LEAVE_PENDING");
      assert.equal(row.status, "ลา รออนุมัติ");
      assert.ok(String(row.note).includes("ใบลารออนุมัติ"));
      assert.ok(String(r.footnote).includes("ลารออนุมัติ"), "footnote does not mention waiting leave");
    });
    await check("the 30-day watch list does not count the waiting day as absent", async () => {
      const w: any = await loadAttendanceWatch(COMPANY, hr);
      const mine = w.people.find((x: any) => x.code === absent.code);
      if (mine) assert.ok((mine.pendingLeave ?? 0) >= 1, "waiting day missing from the person's tags");
      lines.push(`      (watch list people ${w.people.length}; this person listed: ${!!mine})`);
    });

    await tx.leaveRequest.update({ where: { id: req.id }, data: { status: "REJECTED" } });
    await check("refused: back to absent", async () => assert.equal((await statusOf(absent.code)).status, "ABSENT"));
    await tx.leaveRequest.update({ where: { id: req.id }, data: { status: "CANCELLED" } });
    await check("cancelled: back to absent", async () => assert.equal((await statusOf(absent.code)).status, "ABSENT"));
    await tx.leaveRequest.update({ where: { id: req.id }, data: { status: "APPROVED" } });
    await check("approved: on leave", async () => assert.equal((await statusOf(absent.code)).status, "ON_LEAVE"));
    await tx.leaveRequest.update({ where: { id: req.id }, data: { status: "PENDING", deletedAt: new Date() } });
    await check("a deleted waiting request counts for nothing", async () => assert.equal((await statusOf(absent.code)).status, "ABSENT"));
    await tx.leaveRequest.update({ where: { id: req.id }, data: { deletedAt: null, unit: "HOUR", days: 0, hours: 1, startTime: "15:00", endTime: "16:00" } });
    await check("a waiting request for an hour does not excuse a day with no scan", async () => assert.equal((await statusOf(absent.code)).status, "ABSENT"));
    await tx.leaveRequest.update({ where: { id: req.id }, data: { unit: "DAY", days: 0.5, hours: null, startTime: null, endTime: null, halfDay: true, halfDayPeriod: "MORNING" } });
    await check("a waiting half-day request is waiting too", async () => {
      const p = await statusOf(absent.code);
      assert.equal(p.status, "LEAVE_PENDING");
      assert.ok(p.pendingLeaveNote.includes("ครึ่งวันเช้า"), p.pendingLeaveNote);
    });
    await tx.leaveRequest.delete({ where: { id: req.id } });

    const req2 = await mk(normal.employeeId);
    await check("someone who scanned in keeps the status their scan gives, even with a waiting request", async () => {
      const p = await statusOf(normal.code);
      assert.equal(p.status, normal.status);
      assert.equal(p.pendingLeaveNote, null);
    });
    await tx.leaveRequest.delete({ where: { id: req2.id } });
    await check("back to the starting counts once the test requests are gone", async () => {
      const t: any = await loadTodayAttendance(COMPANY, hr, undefined, AS_OF);
      assert.deepEqual(t.counts, base.counts);
    });
    g.__tx = undefined;
    throw new Rollback();
  };
  try {
    await real.$transaction(body, { timeout: 240_000, maxWait: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = await snap();
  await check("nothing was written", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
