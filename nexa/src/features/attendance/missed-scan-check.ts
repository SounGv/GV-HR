import { prisma } from "@/lib/prisma";
import { createNotification } from "@/features/notification/service";
import { broadcastToLineGroups } from "@/lib/integrations/line-group-broadcast";

interface Flagged {
  employeeId: string;
  name: string;
  managerId: string | null;
  issue: "no_clock_out" | "no_scan_at_all";
}

/**
 * Checks the most recently completed business day (Bangkok "yesterday") for
 * two things: clocked in but never clocked out ("ลืมสแกนออก"), and no
 * attendance record at all with no approved leave covering the day
 * ("ไม่มีข้อมูลลงเวลาเลย" — could be a forgotten scan, could be a genuine
 * unexcused absence; phrased as "needs checking", never asserted as fact).
 *
 * Sunday is the only universal day off skipped here — Saturday is a real
 * work day for everyone (half-day for most, a full day for DAILY_WORKER;
 * see lib/attendance-shift.ts), so a missing Saturday record is still worth
 * flagging. Company holidays are skipped per company.
 *
 * Notifies the employee (link to submit a correction) and their manager
 * in-app, plus one consolidated LINE group summary per company — never one
 * message per person, so a bad day for 10 people doesn't spam the group
 * with 10 separate pushes. Meant to run once daily via Vercel Cron, in the
 * morning (see vercel.json + src/app/api/cron/attendance-check/route.ts).
 */
export async function checkMissedScans(): Promise<{ checked: number; flagged: number }> {
  const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const yesterday = new Date(
    Date.UTC(nowBangkok.getUTCFullYear(), nowBangkok.getUTCMonth(), nowBangkok.getUTCDate() - 1),
  );
  if (yesterday.getUTCDay() === 0) return { checked: 0, flagged: 0 }; // Sunday — universal day off
  const dateLabel = yesterday.toISOString().slice(0, 10);

  const companies = await prisma.company.findMany({ select: { id: true } });
  let checked = 0;
  let flagged = 0;

  for (const company of companies) {
    const holiday = await prisma.holiday.findFirst({
      where: { companyId: company.id, deletedAt: null, date: yesterday },
      select: { id: true },
    });
    if (holiday) continue;

    const employees = await prisma.employee.findMany({
      // Most real employee records have no hireDate on file at all — Prisma's
      // `lte` on a null column never matches, so a plain `hireDate: { lte }`
      // here would silently exclude everyone without one instead of just
      // the (rare) case of someone who genuinely hasn't started yet.
      where: {
        companyId: company.id,
        deletedAt: null,
        status: "ACTIVE",
        OR: [{ hireDate: null }, { hireDate: { lte: yesterday } }],
      },
      select: { id: true, firstName: true, lastName: true, managerId: true },
    });
    if (employees.length === 0) continue;
    checked += employees.length;

    const twoWeeksBefore = new Date(yesterday.getTime() - 14 * 86_400_000);
    const [records, approvedLeaves, recentActivity] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { companyId: company.id, deletedAt: null, workDate: yesterday },
        select: { employeeId: true, clockInAt: true, clockOutAt: true },
      }),
      prisma.leaveRequest.findMany({
        where: { companyId: company.id, deletedAt: null, status: "APPROVED", startDate: { lte: yesterday }, endDate: { gte: yesterday } },
        select: { employeeId: true },
      }),
      // Real adoption of self-service clock-in is uneven — most employees
      // here have never once used it. Flagging "no scan at all" company-wide
      // would mean re-flagging the same 80-ish never-onboarded people every
      // single day forever, which trains everyone to ignore the alert. Only
      // employees with a recent record (last 14 days) are treated as active
      // app users whose sudden gap is actually notable; everyone else is
      // left out of this specific check (still covered by the separate
      // "no clock-out" check, which only fires for whoever DID clock in).
      prisma.attendanceRecord.groupBy({
        by: ["employeeId"],
        where: { companyId: company.id, deletedAt: null, workDate: { gte: twoWeeksBefore, lt: yesterday } },
      }),
    ]);
    const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));
    const onLeave = new Set(approvedLeaves.map((l) => l.employeeId));
    const recentlyActive = new Set(recentActivity.map((r) => r.employeeId));

    const results: Flagged[] = [];
    for (const e of employees) {
      if (onLeave.has(e.id)) continue;
      const rec = recordByEmployee.get(e.id);
      const name = `${e.firstName} ${e.lastName}`;
      if (rec?.clockInAt && !rec.clockOutAt) {
        results.push({ employeeId: e.id, name, managerId: e.managerId, issue: "no_clock_out" });
      } else if (!rec && recentlyActive.has(e.id)) {
        results.push({ employeeId: e.id, name, managerId: e.managerId, issue: "no_scan_at_all" });
      }
    }
    if (results.length === 0) continue;
    flagged += results.length;

    // Sequential — the pooled DB connection (connection_limit=1) can't
    // afford concurrent notification writes.
    for (const r of results) {
      const issueLabel = r.issue === "no_clock_out" ? "ลืมสแกนออกงาน" : "ไม่มีข้อมูลลงเวลาเข้า-ออกงาน";
      await createNotification(company.id, r.employeeId, {
        title: `${issueLabel} เมื่อวันที่ ${dateLabel}`,
        body: "ถ้าลงเวลาไม่ครบจริง กรุณายื่นคำขอแก้ไขเวลาเข้า-ออกงาน",
        category: "attendance",
        link: "/attendance/corrections",
      });
      if (r.managerId) {
        await createNotification(company.id, r.managerId, {
          title: `${r.name} ${issueLabel}`,
          body: `วันที่ ${dateLabel} — ตรวจสอบและอนุมัติคำขอแก้ไขเวลาถ้ามีการยื่นมา`,
          category: "attendance",
          link: "/attendance/corrections",
        });
      }
    }

    const noClockOut = results.filter((r) => r.issue === "no_clock_out").map((r) => r.name);
    const noScan = results.filter((r) => r.issue === "no_scan_at_all").map((r) => r.name);
    const lines = [`📋 สรุปการลงเวลาที่ต้องตรวจสอบ — วันที่ ${dateLabel}`];
    if (noClockOut.length) lines.push(`ลืมสแกนออก (${noClockOut.length}): ${noClockOut.join(", ")}`);
    if (noScan.length) lines.push(`ไม่มีข้อมูลลงเวลาเลย — อาจลืมสแกนหรือขาดงาน ต้องตรวจสอบ (${noScan.length}): ${noScan.join(", ")}`);
    await broadcastToLineGroups(company.id, "hr-alerts", lines.join("\n"));
  }

  return { checked, flagged };
}
