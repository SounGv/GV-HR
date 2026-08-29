import { prisma } from "@/lib/prisma";
import { formatDate, loginIdentifier } from "@/lib/format";
import { STATUS_LABEL, EMPLOYMENT_LABEL } from "@/features/employee/labels";
import { ATTENDANCE_STATUS_LABEL, WORK_MODE_LABEL } from "@/features/attendance/status-badge";
import { EXPENSE_STATUS_LABEL, EXPENSE_CATEGORY_LABEL } from "@/features/expense/labels";
import { bangkokParts, lateOrPresent } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { REPORT_LABELS, type ReportQuery } from "./schema";

const GOAL_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังดำเนินการ",
  AT_RISK: "เสี่ยงไม่สำเร็จ",
  COMPLETED: "สำเร็จแล้ว",
  CANCELLED: "ยกเลิก",
};

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
  /** Cell value is an image URL (or "-") — rendered as a clickable thumbnail. */
  photo?: boolean;
}
export interface ReportSummaryDatum {
  label: string;
  value: number;
}
export interface ReportResult {
  title: string;
  period: string | null;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary?: ReportSummaryDatum[];
  summaryLabel?: string;
  summaryUnit?: string;
  /** Second chart, currently only populated by the payroll report (SSO/withholding-tax totals to remit). */
  secondarySummary?: ReportSummaryDatum[];
  secondarySummaryLabel?: string;
  secondarySummaryUnit?: string;
  /** Totals/averages line shown under the table, replacing the generic "รวม N รายการ" when set. */
  footnote?: string;
}

/** Rolls a per-department accumulator map into the chart-ready summary array, sorted by value desc. */
function toSummary(map: Map<string, number>): ReportSummaryDatum[] {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value);
}

function bumpDept(map: Map<string, number>, deptName: string | undefined, amount: number) {
  const key = deptName ?? "ไม่มีแผนก";
  map.set(key, (map.get(key) ?? 0) + amount);
}

/** "09:00" from a minutes-of-day integer — for displaying a resolved shift's
 * start/end alongside the actual clock-in/out, not just using it internally. */
function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Batch-resolve user ids (updatedById/approverUserId etc.) to a display
 * name — the linked employee's real name when there is one, else the login
 * identifier (email/username) for accounts with no employee record. One
 * query for the whole result set instead of N+1 per row. */
async function resolveUserNames(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, username: true, employee: { select: { firstName: true, lastName: true } } },
  });
  return new Map(
    users.map((u) => [u.id, u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : loginIdentifier(u)]),
  );
}

/** [start, end) date window. Defaults to the current calendar month. */
function computeRange(q: ReportQuery) {
  const now = new Date();
  const start = q.from
    ? new Date(`${q.from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end: Date;
  if (q.to) {
    const [y, m, d] = q.to.split("-").map(Number);
    end = new Date(Date.UTC(y, m - 1, d + 1)); // inclusive end-of-day → exclusive
  } else {
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }
  return { start, end };
}

function rangeLabel(start: Date, end: Date): string {
  const s = start.toISOString().slice(0, 10);
  const e = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10);
  return `${s} ถึง ${e}`;
}

export async function getReport(companyId: string, query: ReportQuery): Promise<ReportResult> {
  const title = REPORT_LABELS[query.type];
  const { start, end } = computeRange(query);
  const label = rangeLabel(start, end);
  // Direct + relation filters to scope reports to one department and/or an
  // AI-granted employee scope (see ReportQuery.employeeWhere) — merged into
  // one place so every report type below picks it up automatically.
  const employeeFilter = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.employmentType ? { employmentType: query.employmentType } : {}),
    ...(query.employeeId ? { id: query.employeeId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
    ...(query.employeeWhere ?? {}),
  };
  const deptRel = Object.keys(employeeFilter).length ? { employee: employeeFilter } : {};

  if (query.type === "employees") {
    const emps = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, ...employeeFilter },
      select: {
        employeeCode: true,
        firstName: true,
        lastName: true,
        status: true,
        hireDate: true,
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
      orderBy: { employeeCode: "asc" },
    });
    return {
      title,
      period: null,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "department", label: "แผนก" },
        { key: "position", label: "ตำแหน่ง" },
        { key: "status", label: "สถานะ" },
        { key: "hireDate", label: "วันเริ่มงาน" },
      ],
      rows: emps.map((e) => ({
        code: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? "-",
        position: e.position?.title ?? "-",
        status: STATUS_LABEL[e.status],
        hireDate: e.hireDate ? formatDate(e.hireDate) : "-",
      })),
    };
  }

  if (query.type === "attendance") {
    // Absent days aren't a stored AttendanceRecord status anywhere in this
    // app (nothing ever writes status: "ABSENT" — see attendance service) —
    // they only exist as "a business day this employee has no record, no
    // approved leave, and it isn't a holiday." So this report has to start
    // from the active-employee roster (not just employees who have a
    // record), and derive absence the same way the calendar view's
    // getMyDayStatus does, aggregated over the period instead of per day.
    const [employees, recs, holidays, leaves, pendingLeaves, ots] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: "ACTIVE", ...employeeFilter },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      }),
      prisma.attendanceRecord.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          status: true,
          workDate: true,
          clockInAt: true,
          clockOutAt: true,
          earlyLeaveOut: true,
          workMode: true,
          employee: { select: { employeeCode: true } },
        },
      }),
      prisma.holiday.findMany({ where: { companyId, deletedAt: null, date: { gte: start, lt: end } }, select: { date: true } }),
      prisma.leaveRequest.findMany({
        where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: end }, endDate: { gte: start }, ...deptRel },
        select: {
          startDate: true,
          endDate: true,
          days: true,
          type: true,
          attachmentUrl: true,
          employee: { select: { employeeCode: true } },
        },
      }),
      // Pending requests are invisible from every other angle of this report
      // (the "leave" report type only ever queries APPROVED) — surfaced here
      // as a per-employee count so HR sees what's still awaiting a decision,
      // not just what's already settled.
      prisma.leaveRequest.groupBy({
        by: ["employeeId"],
        where: { companyId, deletedAt: null, status: "PENDING", startDate: { lt: end }, endDate: { gte: start }, ...deptRel },
        _count: { _all: true },
      }),
      prisma.overtimeRequest.groupBy({
        by: ["employeeId"],
        where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: start, lt: end } },
        _sum: { hours: true },
      }),
    ]);

    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const DAY_MS = 86_400_000;
    let businessDays = 0;
    for (let d = new Date(start); d.getTime() < end.getTime(); d = new Date(d.getTime() + DAY_MS)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (holidayDates.has(d.toISOString().slice(0, 10))) continue;
      businessDays++;
    }
    const clippedDays = (leaveStart: Date, leaveEnd: Date, storedDays: number) => {
      if (leaveStart >= start && leaveEnd < end) return storedDays;
      const clipStart = leaveStart < start ? start : leaveStart;
      const clipEndExclusive = leaveEnd >= end ? end : new Date(leaveEnd.getTime() + DAY_MS);
      return Math.max(0, Math.round((clipEndExclusive.getTime() - clipStart.getTime()) / DAY_MS));
    };

    const map = new Map<
      string,
      {
        name: string; present: number; late: number; hours: number; leave: number; earlyLeave: number;
        onsite: number; wfh: number; outside: number; otHours: number; noClockOut: number;
        sick: number; personal: number; annual: number; unpaidOther: number;
        attachedLeaves: number; pendingLeave: number;
      }
    >();
    for (const e of employees) {
      map.set(e.employeeCode, {
        name: `${e.firstName} ${e.lastName}`,
        present: 0, late: 0, hours: 0, leave: 0, earlyLeave: 0, onsite: 0, wfh: 0, outside: 0, otHours: 0,
        noClockOut: 0, sick: 0, personal: 0, annual: 0, unpaidOther: 0, attachedLeaves: 0, pendingLeave: 0,
      });
    }
    // A day covered by approved leave can still carry status:"LATE" on its
    // AttendanceRecord — e.g. an approved AM half-day leave, then the
    // employee clocks in "late" for the PM half relative to the full-day
    // shift start. Payroll's own absence/late derivation already excludes
    // these (see payroll/service.ts's getAbsenceAndLateByEmployee); this
    // report read the raw stored field directly and disagreed with payroll,
    // showing a "late" occurrence payroll never deducted for. Reuse the same
    // `leaves` rows already loaded above instead of a second query.
    const leaveRangesByCode = new Map<string, { start: Date; end: Date }[]>();
    for (const l of leaves) {
      const list = leaveRangesByCode.get(l.employee.employeeCode) ?? [];
      list.push({ start: l.startDate, end: l.endDate });
      leaveRangesByCode.set(l.employee.employeeCode, list);
    }
    const isOnLeave = (code: string, workDate: Date) =>
      (leaveRangesByCode.get(code) ?? []).some((r) => r.start.getTime() <= workDate.getTime() && workDate.getTime() <= r.end.getTime());

    const deptLate = new Map<string, number>();
    for (const r of recs) {
      const row = map.get(r.employee.employeeCode);
      if (!row) continue; // e.g. an inactive employee's leftover record
      if (r.clockInAt) row.present += 1;
      if (r.status === "LATE" && !isOnLeave(r.employee.employeeCode, r.workDate)) row.late += 1;
      if (r.earlyLeaveOut) row.earlyLeave += 1;
      if (r.clockInAt && !r.clockOutAt) row.noClockOut += 1;
      if (r.clockInAt) {
        if (r.workMode === "WFH") row.wfh += 1;
        else if (r.workMode === "OUTSIDE") row.outside += 1;
        else row.onsite += 1;
      }
      if (r.clockInAt && r.clockOutAt) row.hours += (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000;
    }
    for (const l of leaves) {
      const row = map.get(l.employee.employeeCode);
      if (!row) continue;
      const days = clippedDays(l.startDate, l.endDate, l.days);
      row.leave += days;
      if (l.type === "SICK") row.sick += days;
      else if (l.type === "PERSONAL") row.personal += days;
      else if (l.type === "ANNUAL") row.annual += days;
      else row.unpaidOther += days; // UNPAID/OTHER
      if (l.attachmentUrl) row.attachedLeaves += 1;
    }
    for (const p of pendingLeaves) {
      const code = employees.find((e) => e.id === p.employeeId)?.employeeCode;
      const row = code ? map.get(code) : undefined;
      if (row) row.pendingLeave += p._count._all;
    }
    const codeById = new Map(employees.map((e) => [e.id, e.employeeCode]));
    for (const o of ots) {
      const code = codeById.get(o.employeeId);
      const row = code ? map.get(code) : undefined;
      if (row) row.otHours += o._sum.hours ?? 0;
    }
    for (const [code, v] of map) {
      if (v.late > 0) {
        const emp = employees.find((e) => e.employeeCode === code);
        bumpDept(deptLate, emp?.department?.name, v.late);
      }
    }
    return {
      title,
      period: label,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "scheduled", label: "วันทำงานตามกำหนด", numeric: true },
        { key: "present", label: "วันมาทำงาน", numeric: true },
        { key: "rate", label: "% อัตราการมาทำงาน", numeric: true },
        { key: "late", label: "วันมาสาย", numeric: true },
        { key: "earlyLeave", label: "วันออกก่อนเวลา", numeric: true },
        { key: "noClockOut", label: "ไม่ลงเวลาออก (วัน)", numeric: true },
        { key: "sick", label: "ลาป่วย (วัน)", numeric: true },
        { key: "personal", label: "ลากิจ (วัน)", numeric: true },
        { key: "annual", label: "ลาพักร้อน (วัน)", numeric: true },
        { key: "unpaidOther", label: "ลาไม่รับค่าจ้าง/อื่นๆ (วัน)", numeric: true },
        { key: "leave", label: "วันลารวม", numeric: true },
        { key: "attachedLeaves", label: "ใบลามีเอกสารแนบ", numeric: true },
        { key: "pendingLeave", label: "รออนุมัติ (รายการ)", numeric: true },
        { key: "absent", label: "วันขาดงาน", numeric: true },
        { key: "onsite", label: "วันที่สำนักงาน", numeric: true },
        { key: "wfh", label: "วัน WFH", numeric: true },
        { key: "outside", label: "วันนอกสถานที่", numeric: true },
        { key: "hours", label: "ชั่วโมงรวม", numeric: true },
        { key: "otHours", label: "ชั่วโมง OT", numeric: true },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code,
        name: v.name,
        scheduled: businessDays,
        present: v.present,
        rate: businessDays > 0 ? Math.round((v.present / businessDays) * 1000) / 10 : 0,
        late: v.late,
        earlyLeave: v.earlyLeave,
        noClockOut: v.noClockOut,
        sick: Math.round(v.sick * 10) / 10,
        personal: Math.round(v.personal * 10) / 10,
        annual: Math.round(v.annual * 10) / 10,
        unpaidOther: Math.round(v.unpaidOther * 10) / 10,
        leave: Math.round(v.leave * 10) / 10,
        attachedLeaves: v.attachedLeaves,
        pendingLeave: v.pendingLeave,
        absent: Math.max(0, Math.round((businessDays - v.present - v.leave) * 10) / 10),
        onsite: v.onsite,
        wfh: v.wfh,
        outside: v.outside,
        hours: Math.round(v.hours * 10) / 10,
        otHours: Math.round(v.otHours * 10) / 10,
      })),
      summary: toSummary(deptLate),
      summaryLabel: "จำนวนวันมาสายตามแผนก",
      summaryUnit: "วัน",
    };
  }

  if (query.type === "attendance_daily") {
    const [recs, branches, ots] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          employeeId: true,
          workDate: true,
          clockInAt: true,
          clockOutAt: true,
          breakStartAt: true,
          breakEndAt: true,
          status: true,
          workMode: true,
          note: true,
          clockInBranchId: true,
          clockInDistance: true,
          clockInPhotoUrl: true,
          clockOutPhotoUrl: true,
          updatedById: true,
          employee: {
            select: {
              employeeCode: true,
              firstName: true,
              lastName: true,
              employmentType: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }],
        take: 1000,
      }),
      prisma.branch.findMany({ where: { companyId }, select: { id: true, name: true } }),
      // Same APPROVED-only convention as the standalone "overtime" report
      // below — joined in here by (employeeId, date) so each attendance row
      // can show that day's OT alongside its regular hours.
      prisma.overtimeRequest.findMany({
        where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: start, lt: end }, ...deptRel },
        select: { employeeId: true, date: true, hours: true },
      }),
    ]);
    // Sequential, not folded into the Promise.all above — same pooled-
    // connection reasoning as elsewhere in this codebase (e.g. the
    // dashboard): a 4th concurrent query risks P2024 under connection_limit=1.
    const shiftMap = await resolveShiftMinutesBatch(companyId, start, end);
    const editorNameById = await resolveUserNames(recs.map((r) => r.updatedById));
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const otByKey = new Map<string, number>();
    for (const o of ots) {
      const key = `${o.employeeId}|${o.date.toISOString().slice(0, 10)}`;
      otByKey.set(key, (otByKey.get(key) ?? 0) + o.hours);
    }
    const fmtTime = (d: Date | null) =>
      d
        ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(d)
        : "-";
    // Same "clock-out minus clock-in" convention as attendance-history.tsx's
    // workedHours() — kept a plain rounded number (not "X.X ชม.") here since
    // the column label already states the unit and this report is also
    // exported straight to CSV.
    const hoursWorked = (clockInAt: Date | null, clockOutAt: Date | null): number | "-" => {
      if (!clockInAt || !clockOutAt) return "-";
      const ms = clockOutAt.getTime() - clockInAt.getTime();
      return ms > 0 ? Math.round((ms / 3_600_000) * 100) / 100 : "-";
    };
    // Minutes late vs. the employee's real shift start when HR scheduled one
    // (ShiftAssignment), else the company default 09:00 — same cutoff
    // lib/datetime.ts's lateOrPresent uses. "-" when on time/early so it
    // doesn't just duplicate the "สถานะ" column with a redundant "0".
    const lateMinutesOf = (clockInAt: Date | null, shiftStartMin: number): number | "-" => {
      if (!clockInAt) return "-";
      const late = bangkokParts(clockInAt).minutesOfDay - shiftStartMin;
      return late > 0 ? late : "-";
    };
    // Symmetric to lateMinutesOf, but for clocking out before the shift ends
    // — "-" once clocked out at/after shift end (nothing early to report).
    const earlyMinutesOf = (clockOutAt: Date | null, shiftEndMin: number): number | "-" => {
      if (!clockOutAt) return "-";
      const early = shiftEndMin - bangkokParts(clockOutAt).minutesOfDay;
      return early > 0 ? early : "-";
    };
    const breakMinutesOf = (breakStartAt: Date | null, breakEndAt: Date | null): number | "-" => {
      if (!breakStartAt || !breakEndAt) return "-";
      const ms = breakEndAt.getTime() - breakStartAt.getTime();
      return ms > 0 ? Math.round(ms / 60_000) : "-";
    };
    // Hours actually worked past the shift end (real shift if assigned, else
    // the 09:00–18:00 default) — most employees (esp. daily-wage warehouse
    // staff with no app account) never file a formal OvertimeRequest at all,
    // so an APPROVED-only figure was blank for them every day despite clearly
    // working late. Used as the OT figure whenever no approved request
    // exists; the approved amount wins when one does, so a real filed/paid
    // OT request is never silently overridden by the raw clock-time estimate.
    const calculatedOtHoursOf = (clockOutAt: Date | null, shiftEndMin: number): number => {
      if (!clockOutAt) return 0;
      const over = bangkokParts(clockOutAt).minutesOfDay - shiftEndMin;
      return over > 0 ? Math.round((over / 60) * 100) / 100 : 0;
    };

    let totalHours = 0;
    let hoursCount = 0;
    let totalOt = 0;
    let lateCount = 0;
    let totalLateMinutes = 0;

    const rows = recs.map((r) => {
      const hours = hoursWorked(r.clockInAt, r.clockOutAt);
      if (typeof hours === "number") {
        totalHours += hours;
        hoursCount++;
      }
      const otKey = `${r.employeeId}|${r.workDate.toISOString().slice(0, 10)}`;
      const approvedOt = otByKey.get(otKey);
      const shift = shiftMinutesFromBatch(shiftMap, r.employeeId, r.workDate);
      const otHoursNum = approvedOt ?? calculatedOtHoursOf(r.clockOutAt, shift.endMin);
      if (otHoursNum) totalOt += otHoursNum;
      const lateMinutes = lateMinutesOf(r.clockInAt, shift.startMin);
      if (typeof lateMinutes === "number") {
        lateCount++;
        totalLateMinutes += lateMinutes;
      }
      // Recomputed against the employee's real shift rather than trusting
      // the stored `status` — that field was set at clock-in time using
      // whichever cutoff was in effect then, which for anyone HR has since
      // assigned a real shift to (or backdated a shift assignment for) may
      // no longer match. Keeps this column consistent with "สาย (นาที)" on
      // the same row instead of the two silently contradicting each other.
      // Only PRESENT/LATE are reclassified — ON_LEAVE/ABSENT come from leave
      // requests / absence derivation, not the clock-in cutoff, and must
      // never be overwritten by it.
      const status =
        r.clockInAt != null && (r.status === "PRESENT" || r.status === "LATE")
          ? lateOrPresent(bangkokParts(r.clockInAt).minutesOfDay, shift.startMin)
          : r.status;
      return {
        date: formatDate(r.workDate),
        code: r.employee.employeeCode,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department?.name ?? "-",
        employmentType: EMPLOYMENT_LABEL[r.employee.employmentType] ?? r.employee.employmentType,
        shiftStart: minutesToHHMM(shift.startMin),
        shiftEnd: minutesToHHMM(shift.endMin),
        clockIn: fmtTime(r.clockInAt),
        clockOut: fmtTime(r.clockOutAt),
        breakMinutes: breakMinutesOf(r.breakStartAt, r.breakEndAt),
        hours,
        otHours: otHoursNum ? Math.round(otHoursNum * 100) / 100 : "-",
        lateMinutes,
        earlyMinutes: earlyMinutesOf(r.clockOutAt, shift.endMin),
        status: ATTENDANCE_STATUS_LABEL[status] ?? status,
        statusKey: status,
        workMode: WORK_MODE_LABEL[r.workMode] ?? r.workMode,
        note: r.note ?? "-",
        editor: r.updatedById ? editorNameById.get(r.updatedById) ?? "-" : "-",
        location: r.clockInBranchId ? branchName.get(r.clockInBranchId) ?? "-" : "-",
        distance: r.clockInDistance != null ? Math.round(r.clockInDistance) : "-",
        clockInPhoto: r.clockInPhotoUrl ?? "-",
        clockOutPhoto: r.clockOutPhotoUrl ?? "-",
      };
    });

    const avgHours = hoursCount ? totalHours / hoursCount : 0;
    const footnote =
      `รวม ${recs.length} รายการ · ชั่วโมงทำงานรวม ${totalHours.toFixed(2)} ชม. ` +
      `(เฉลี่ย ${avgHours.toFixed(2)} ชม./วัน) · OT รวม ${totalOt.toFixed(2)} ชม. · ` +
      `มาสาย ${lateCount} ครั้ง (รวม ${totalLateMinutes} นาที)`;

    return {
      title,
      period: label,
      footnote,
      columns: [
        { key: "date", label: "วันที่" },
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "department", label: "แผนก" },
        { key: "employmentType", label: "ประเภทการจ้าง" },
        { key: "shiftStart", label: "เวลาเริ่มกะ" },
        { key: "shiftEnd", label: "เวลาเลิกกะ" },
        { key: "clockIn", label: "เวลาเข้า" },
        { key: "clockOut", label: "เวลาออก" },
        { key: "breakMinutes", label: "เวลาพัก (นาที)", numeric: true },
        { key: "hours", label: "ชั่วโมงทำงาน", numeric: true },
        { key: "otHours", label: "ชั่วโมง OT", numeric: true },
        { key: "status", label: "สถานะ" },
        { key: "lateMinutes", label: "สาย (นาที)", numeric: true },
        { key: "earlyMinutes", label: "ออกก่อน (นาที)", numeric: true },
        { key: "workMode", label: "รูปแบบงาน" },
        { key: "note", label: "หมายเหตุ" },
        { key: "editor", label: "ผู้แก้ไขเวลา" },
        { key: "location", label: "สถานที่" },
        { key: "distance", label: "ระยะห่าง (ม.)", numeric: true },
        { key: "clockInPhoto", label: "รูปเช็คอิน", photo: true },
        { key: "clockOutPhoto", label: "รูปเช็คเอาท์", photo: true },
      ],
      rows,
    };
  }

  if (query.type === "leave") {
    const year = start.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    // ANNUAL/SICK/PERSONAL usedDays comes from LeaveBalance (the authoritative
    // running total — increment/decrement already accounts for cancellations).
    // UNPAID/OTHER never get a balance row at all (deductsBalance() is false
    // for both, see days.ts), so they're summed straight from approved
    // requests instead — otherwise those two leave types silently vanish
    // from this report despite being real, trackable leave.
    const [bals, unpaidOther] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { companyId, year, ...deptRel },
        select: {
          type: true,
          usedDays: true,
          employee: {
            select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: "APPROVED",
          type: { in: ["UNPAID", "OTHER"] },
          startDate: { lt: yearEnd },
          endDate: { gte: yearStart },
          ...deptRel,
        },
        select: {
          type: true,
          days: true,
          employee: {
            select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
          },
        },
      }),
    ]);
    const map = new Map<
      string,
      { name: string; ANNUAL: number; SICK: number; PERSONAL: number; UNPAID: number; OTHER: number }
    >();
    const deptDays = new Map<string, number>();
    const rowFor = (code: string, name: string) => {
      const row = map.get(code) ?? { name, ANNUAL: 0, SICK: 0, PERSONAL: 0, UNPAID: 0, OTHER: 0 };
      map.set(code, row);
      return row;
    };
    for (const b of bals) {
      const code = b.employee.employeeCode;
      const row = rowFor(code, `${b.employee.firstName} ${b.employee.lastName}`);
      if (b.type === "ANNUAL" || b.type === "SICK" || b.type === "PERSONAL") row[b.type] += b.usedDays;
      bumpDept(deptDays, b.employee.department?.name, b.usedDays);
    }
    for (const r of unpaidOther) {
      const code = r.employee.employeeCode;
      const row = rowFor(code, `${r.employee.firstName} ${r.employee.lastName}`);
      row[r.type as "UNPAID" | "OTHER"] += r.days;
      bumpDept(deptDays, r.employee.department?.name, r.days);
    }
    return {
      title,
      period: `ปี ${year}`,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "annual", label: "ลาพักร้อน (วัน)", numeric: true },
        { key: "sick", label: "ลาป่วย (วัน)", numeric: true },
        { key: "personal", label: "ลากิจ (วัน)", numeric: true },
        { key: "unpaid", label: "ลาไม่รับค่าจ้าง (วัน)", numeric: true },
        { key: "other", label: "ลาอื่นๆ (วัน)", numeric: true },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, annual: v.ANNUAL, sick: v.SICK, personal: v.PERSONAL, unpaid: v.UNPAID, other: v.OTHER,
      })),
      summary: toSummary(deptDays),
      summaryLabel: "วันลารวมตามแผนก",
      summaryUnit: "วัน",
    };
  }

  if (query.type === "overtime") {
    // Every request in range regardless of status (not just APPROVED) — one
    // row per request, since date/start-end/reason/approver only make sense
    // per-record, not aggregated. The department chart below still only
    // counts APPROVED hours (an OT that was never approved never happened).
    const ots = await prisma.overtimeRequest.findMany({
      where: { companyId, deletedAt: null, date: { gte: start, lt: end }, ...deptRel },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        hours: true,
        multiplier: true,
        estimatedAmount: true,
        reason: true,
        status: true,
        paidAt: true,
        approverUserId: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ date: "desc" }, { employee: { employeeCode: "asc" } }],
    });
    const approverNameById = await resolveUserNames(ots.map((o) => o.approverUserId));
    const deptHours = new Map<string, number>();
    for (const o of ots) {
      if (o.status === "APPROVED") bumpDept(deptHours, o.employee.department?.name, o.hours);
    }
    // 4 real states — PENDING/REJECTED/CANCELLED come straight from the
    // stored status; APPROVED splits into "อนุมัติแล้ว" vs "จ่ายแล้ว" based
    // on paidAt (set once a payroll run that included it is marked PAID —
    // see payroll/service.ts's markPaid()).
    const OT_STATUS_LABEL: Record<string, string> = {
      PENDING: "รออนุมัติ",
      APPROVED: "อนุมัติแล้ว",
      REJECTED: "ไม่อนุมัติ",
      CANCELLED: "ยกเลิก",
    };
    const statusLabel = (o: (typeof ots)[number]) =>
      o.status === "APPROVED" && o.paidAt ? "จ่ายแล้ว" : OT_STATUS_LABEL[o.status] ?? o.status;

    return {
      title,
      period: label,
      columns: [
        { key: "date", label: "วันที่ทำ OT" },
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "department", label: "แผนก" },
        { key: "startTime", label: "เวลาเริ่ม OT" },
        { key: "endTime", label: "เวลาสิ้นสุด OT" },
        { key: "hours", label: "จำนวนชั่วโมง", numeric: true },
        { key: "multiplier", label: "อัตรา OT", numeric: true },
        { key: "amount", label: "จำนวนเงิน OT (บาท)", numeric: true },
        { key: "reason", label: "เหตุผล" },
        { key: "approver", label: "ผู้อนุมัติ" },
        { key: "status", label: "สถานะ" },
      ],
      rows: ots.map((o) => ({
        date: formatDate(o.date),
        code: o.employee.employeeCode,
        name: `${o.employee.firstName} ${o.employee.lastName}`,
        department: o.employee.department?.name ?? "-",
        startTime: o.startTime,
        endTime: o.endTime,
        hours: Math.round(o.hours * 100) / 100,
        multiplier: o.multiplier,
        amount: o.estimatedAmount,
        reason: o.reason ?? "-",
        approver: o.approverUserId ? approverNameById.get(o.approverUserId) ?? "-" : "-",
        status: statusLabel(o),
      })),
      summary: toSummary(deptHours),
      summaryLabel: "ชั่วโมง OT ที่อนุมัติแล้วตามแผนก",
      summaryUnit: "ชม.",
    };
  }

  if (query.type === "payroll") {
    const period = start.toISOString().slice(0, 7); // YYYY-MM of the range start
    const prs = await prisma.payrollRecord.findMany({
      where: { companyId, deletedAt: null, period, ...deptRel },
      select: {
        gross: true,
        totalDeductions: true,
        net: true,
        status: true,
        earnings: true,
        deductions: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });
    const deptNet = new Map<string, number>();
    // "ประกันสังคม"/"ภาษีหัก ณ ที่จ่าย" are constant labels computePayroll()
    // itself always writes (never HR-typed free text), so matching by label
    // here is reliable — not fragile to typos the way an HR-entered line
    // item's label would be.
    const remittance = new Map<string, number>();
    for (const p of prs) {
      bumpDept(deptNet, p.employee.department?.name, Number(p.net));
      const lines = (p.deductions as unknown as { label: string; amount: number }[] | null) ?? [];
      for (const d of lines) {
        if (d.label === "ประกันสังคม" || d.label === "ภาษีหัก ณ ที่จ่าย") {
          remittance.set(d.label, (remittance.get(d.label) ?? 0) + Number(d.amount));
        }
      }
    }
    // Same known-constant-label matching as the company-wide aggregate above,
    // but per employee.
    const lineAmount = (lines: { label: string; amount: number }[], label: string) =>
      lines.find((l) => l.label === label)?.amount ?? 0;
    // calc.ts embeds a count in a few deduction labels (e.g. "หักมาสาย (3
    // ครั้ง)") since the count itself has no separate storage — matched by
    // prefix (not exact label) and the count parsed back out of the text so
    // the report can show both the count and the amount as real columns.
    const linePrefix = (lines: { label: string; amount: number }[], prefix: string) => {
      const line = lines.find((l) => l.label.startsWith(prefix));
      if (!line) return { amount: 0, count: 0 };
      const count = Number(/\((\d+(?:\.\d+)?)\s/.exec(line.label)?.[1] ?? 0);
      return { amount: line.amount, count };
    };
    const KNOWN_DEDUCTION_LABELS = [
      "ประกันสังคม",
      "ภาษีหัก ณ ที่จ่าย",
      "กองทุนสำรองเลี้ยงชีพ",
      "หักชำระเงินกู้",
      "หักเบิกล่วงหน้า",
      "หักลาไม่รับค่าจ้าง",
    ];

    return {
      title,
      period,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "gross", label: "รายได้รวม", numeric: true },
        { key: "otAmount", label: "OT (บาท)", numeric: true },
        { key: "allowances", label: "เบี้ยเลี้ยง (บาท)", numeric: true },
        { key: "socialSecurity", label: "ประกันสังคม", numeric: true },
        { key: "withholdingTax", label: "ภาษีหัก ณ ที่จ่าย", numeric: true },
        { key: "loanDeduction", label: "หักชำระเงินกู้", numeric: true },
        { key: "unpaidLeave", label: "หักลาไม่รับค่าจ้าง", numeric: true },
        { key: "absentDays", label: "จำนวนวันขาดงาน", numeric: true },
        { key: "absenceDeduction", label: "หักขาดงาน (บาท)", numeric: true },
        { key: "lateCount", label: "จำนวนครั้งมาสาย", numeric: true },
        { key: "lateDeduction", label: "หักมาสาย (บาท)", numeric: true },
        { key: "pendingReviewDays", label: "รอตรวจสอบเวลาเข้า-ออก (วัน)", numeric: true },
        { key: "otherDeductions", label: "รายการหักอื่น (บาท)", numeric: true },
        { key: "deductions", label: "รายการหักรวม", numeric: true },
        { key: "net", label: "สุทธิ", numeric: true },
        { key: "status", label: "สถานะ" },
      ],
      rows: prs.map((p) => {
        const earningLines = (p.earnings as unknown as { label: string; amount: number }[] | null) ?? [];
        const lines = (p.deductions as unknown as { label: string; amount: number }[] | null) ?? [];
        const late = linePrefix(lines, "หักมาสาย");
        const absence = linePrefix(lines, "หักขาดงาน");
        const pending = linePrefix(lines, "รอตรวจสอบเวลาเข้า-ออก");
        const knownDeductionsTotal = lines
          .filter((l) => KNOWN_DEDUCTION_LABELS.includes(l.label) || l.label.startsWith("หักมาสาย") || l.label.startsWith("หักขาดงาน"))
          .reduce((s, l) => s + l.amount, 0);
        return {
          code: p.employee.employeeCode,
          name: `${p.employee.firstName} ${p.employee.lastName}`,
          gross: p.gross,
          otAmount: lineAmount(earningLines, "ค่าล่วงเวลา (OT)"),
          allowances: lineAmount(earningLines, "ค่าตำแหน่ง/เบี้ยเลี้ยง"),
          socialSecurity: lineAmount(lines, "ประกันสังคม"),
          withholdingTax: lineAmount(lines, "ภาษีหัก ณ ที่จ่าย"),
          loanDeduction: lineAmount(lines, "หักชำระเงินกู้"),
          unpaidLeave: lineAmount(lines, "หักลาไม่รับค่าจ้าง"),
          absentDays: absence.count,
          absenceDeduction: absence.amount,
          lateCount: late.count,
          lateDeduction: late.amount,
          pendingReviewDays: pending.count,
          otherDeductions: Math.max(0, p.totalDeductions - knownDeductionsTotal),
          deductions: p.totalDeductions,
          net: p.net,
          status: p.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง",
        };
      }),
      summary: toSummary(deptNet),
      summaryLabel: "เงินเดือนสุทธิรวมตามแผนก",
      summaryUnit: "บาท",
      secondarySummary: toSummary(remittance),
      secondarySummaryLabel: "ยอดนำส่งหน่วยงานราชการ (ประกันสังคม/ภาษี) ทั้งบริษัท",
      secondarySummaryUnit: "บาท",
    };
  }

  if (query.type === "expense") {
    // One row per claim (not per-employee-aggregate) — date/category/
    // attachment/approver/payment-date are inherently per-claim, an
    // aggregate row can't show them. Every status, not just APPROVED/PAID,
    // so pending/rejected claims are visible too; the department chart below
    // still only counts APPROVED+PAID (money actually approved/paid).
    const claims = await prisma.expenseClaim.findMany({
      where: { companyId, deletedAt: null, expenseDate: { gte: start, lt: end }, ...deptRel },
      select: {
        expenseDate: true,
        category: true,
        amount: true,
        receiptUrl: true,
        status: true,
        approverUserId: true,
        paidAt: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ expenseDate: "desc" }, { employee: { employeeCode: "asc" } }],
    });
    const approverNameById = await resolveUserNames(claims.map((c) => c.approverUserId));
    const deptApproved = new Map<string, number>();
    for (const c of claims) {
      if (c.status === "APPROVED" || c.status === "PAID") bumpDept(deptApproved, c.employee.department?.name, Number(c.amount));
    }
    return {
      title,
      period: label,
      columns: [
        { key: "date", label: "วันที่เบิก" },
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อพนักงาน" },
        { key: "department", label: "แผนก" },
        { key: "category", label: "ประเภทการเบิก" },
        { key: "amount", label: "จำนวนเงิน (บาท)", numeric: true },
        { key: "attachment", label: "เอกสารแนบ" },
        { key: "approver", label: "ผู้อนุมัติ" },
        { key: "status", label: "สถานะ" },
        { key: "paidDate", label: "วันที่จ่ายเงิน" },
      ],
      rows: claims.map((c) => ({
        date: formatDate(c.expenseDate),
        code: c.employee.employeeCode,
        name: `${c.employee.firstName} ${c.employee.lastName}`,
        department: c.employee.department?.name ?? "-",
        category: EXPENSE_CATEGORY_LABEL[c.category as keyof typeof EXPENSE_CATEGORY_LABEL] ?? c.category,
        amount: Math.round(Number(c.amount) * 100) / 100,
        attachment: c.receiptUrl ? "มีเอกสาร" : "-",
        approver: c.approverUserId ? approverNameById.get(c.approverUserId) ?? "-" : "-",
        status: EXPENSE_STATUS_LABEL[c.status] ?? c.status,
        paidDate: c.paidAt ? formatDate(c.paidAt) : "-",
      })),
      summary: toSummary(deptApproved),
      summaryLabel: "ค่าใช้จ่ายอนุมัติ/จ่ายแล้วรวมตามแผนก",
      summaryUnit: "บาท",
    };
  }

  if (query.type === "performance") {
    // Every review, not just the latest per employee — collapsing to one row
    // used to silently drop all prior-cycle history from the report.
    const reviews = await prisma.performanceReview.findMany({
      where: { companyId, deletedAt: null, ...deptRel },
      select: {
        cycle: true,
        overallScore: true,
        band: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: [{ employee: { employeeCode: "asc" } }, { createdAt: "desc" }],
    });
    return {
      title,
      period: null,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "cycle", label: "รอบประเมิน" },
        { key: "score", label: "คะแนนรวม", numeric: true },
        { key: "band", label: "ระดับ" },
      ],
      rows: reviews.map((r) => ({
        code: r.employee.employeeCode,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        cycle: r.cycle,
        score: Math.round(r.overallScore * 10) / 10,
        band: r.band,
      })),
    };
  }

  if (query.type === "kpi" || query.type === "okr") {
    const goals = await prisma.goal.findMany({
      where: { companyId, deletedAt: null, type: query.type === "kpi" ? "KPI" : "OKR", ...deptRel },
      select: {
        cycle: true,
        targetValue: true,
        currentValue: true,
        status: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, { name: string; cycle: string; target: number; actual: number; status: string }>();
    for (const g of goals) {
      const code = g.employee.employeeCode;
      if (map.has(code)) continue; // most recent goal per employee only
      map.set(code, {
        name: `${g.employee.firstName} ${g.employee.lastName}`,
        cycle: g.cycle,
        target: g.targetValue,
        actual: g.currentValue,
        status: GOAL_STATUS_LABEL[g.status] ?? g.status,
      });
    }
    return {
      title,
      period: null,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "cycle", label: "รอบ" },
        { key: "target", label: "เป้าหมาย", numeric: true },
        { key: "actual", label: "ผลจริง", numeric: true },
        { key: "achievement", label: "% สำเร็จ", numeric: true },
        { key: "status", label: "สถานะ" },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code,
        name: v.name,
        cycle: v.cycle,
        target: v.target,
        actual: v.actual,
        achievement: v.target > 0 ? Math.round((v.actual / v.target) * 1000) / 10 : 0,
        status: v.status,
      })),
    };
  }

  if (query.type === "validation") {
    // Every check below is a genuine query against real data — nothing here
    // is estimated/sampled. Each finding becomes one row so every check can
    // share one table; "ประเภทปัญหา" tells them apart.
    interface Finding {
      [key: string]: string;
      date: string;
      code: string;
      name: string;
      department: string;
      issueType: string;
      detail: string;
    }
    const findings: Finding[] = [];

    const [employees, recs, holidays, leaves, pendingOts, correctionReqs, payrolls] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: "ACTIVE", ...employeeFilter },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      }),
      prisma.attendanceRecord.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          employeeId: true, workDate: true, clockInAt: true, clockOutAt: true, status: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
      prisma.holiday.findMany({ where: { companyId, deletedAt: null, date: { gte: start, lt: end } }, select: { date: true } }),
      prisma.leaveRequest.findMany({
        where: { companyId, deletedAt: null, startDate: { lt: end }, endDate: { gte: start }, ...deptRel },
        select: {
          status: true, startDate: true, endDate: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
      prisma.overtimeRequest.findMany({
        where: { companyId, deletedAt: null, status: "PENDING", date: { gte: start, lt: end }, ...deptRel },
        select: {
          date: true, hours: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
      prisma.attendanceCorrectionRequest.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          workDate: true, status: true, decidedAt: true, createdAt: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
      prisma.payrollRecord.findMany({
        where: { companyId, deletedAt: null, period: start.toISOString().slice(0, 7), ...deptRel },
        select: {
          net: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
        },
      }),
    ]);
    const shiftMap = await resolveShiftMinutesBatch(companyId, start, end);
    const deptOf = (e: { department: { name: string | null } | null }) => e.department?.name ?? "-";
    const nameOf = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

    // No clock-out, and it isn't still today's in-progress shift.
    const todayIso = new Date().toISOString().slice(0, 10);
    for (const r of recs) {
      const d = r.workDate.toISOString().slice(0, 10);
      if (r.clockInAt && !r.clockOutAt && d < todayIso) {
        findings.push({
          date: formatDate(r.workDate), code: r.employee.employeeCode, name: nameOf(r.employee), department: deptOf(r.employee),
          issueType: "ไม่มีเวลาออก", detail: `เช็คอิน ${new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(r.clockInAt)} แต่ไม่มีเวลาออก`,
        });
      }
      if (r.clockInAt && r.clockOutAt && r.clockOutAt.getTime() < r.clockInAt.getTime()) {
        findings.push({
          date: formatDate(r.workDate), code: r.employee.employeeCode, name: nameOf(r.employee), department: deptOf(r.employee),
          issueType: "ชั่วโมงทำงานติดลบ", detail: "เวลาออกมาก่อนเวลาเข้า — ตรวจสอบว่าเป็นข้อมูลผิดวันหรือผิด AM/PM",
        });
      }
      if (r.clockInAt && r.status === "LATE") {
        const shift = shiftMinutesFromBatch(shiftMap, r.employeeId, r.workDate);
        const lateMin = bangkokParts(r.clockInAt).minutesOfDay - shift.startMin;
        if (lateMin > 180) {
          findings.push({
            date: formatDate(r.workDate), code: r.employee.employeeCode, name: nameOf(r.employee), department: deptOf(r.employee),
            issueType: "มาสายผิดปกติ", detail: `สาย ${lateMin} นาที (เกิน 3 ชม.) — ตรวจสอบว่าลงเวลาถูกต้องหรือควรแก้ไขกะ`,
          });
        }
      }
    }

    // Duplicate correction requests for the same day, and retroactive edits.
    const correctionsByKey = new Map<string, typeof correctionReqs>();
    for (const c of correctionReqs) {
      const key = `${c.employee.employeeCode}|${c.workDate.toISOString().slice(0, 10)}`;
      const list = correctionsByKey.get(key) ?? [];
      list.push(c);
      correctionsByKey.set(key, list);
    }
    for (const [, list] of correctionsByKey) {
      const pendingCount = list.filter((c) => c.status === "PENDING").length;
      if (pendingCount > 1) {
        const c = list[0];
        findings.push({
          date: formatDate(c.workDate), code: c.employee.employeeCode, name: nameOf(c.employee), department: deptOf(c.employee),
          issueType: "ข้อมูลเวลาซ้ำ", detail: `มีคำขอแก้ไขเวลาที่รออนุมัติซ้ำกัน ${pendingCount} รายการในวันเดียวกัน`,
        });
      }
    }
    for (const c of correctionReqs) {
      if (c.status === "APPROVED" && c.decidedAt) {
        const gapDays = Math.round((c.decidedAt.getTime() - c.workDate.getTime()) / 86_400_000);
        if (gapDays > 7) {
          findings.push({
            date: formatDate(c.workDate), code: c.employee.employeeCode, name: nameOf(c.employee), department: deptOf(c.employee),
            issueType: "มีการแก้ไขเวลาย้อนหลัง", detail: `อนุมัติแก้ไขเวลา ${gapDays} วันหลังจากวันที่จริง`,
          });
        }
      }
    }

    for (const o of pendingOts) {
      findings.push({
        date: formatDate(o.date), code: o.employee.employeeCode, name: nameOf(o.employee), department: deptOf(o.employee),
        issueType: "OT ยังไม่อนุมัติ", detail: `${o.hours} ชม. รอการอนุมัติ`,
      });
    }
    for (const l of leaves) {
      if (l.status === "PENDING") {
        findings.push({
          date: formatDate(l.startDate), code: l.employee.employeeCode, name: nameOf(l.employee), department: deptOf(l.employee),
          issueType: "ใบลายังไม่อนุมัติ", detail: `${formatDate(l.startDate)} ถึง ${formatDate(l.endDate)} รอการอนุมัติ`,
        });
      }
    }

    // "Absent but a leave document exists" — a business day with no clock-in
    // and no APPROVED leave, where a PENDING/REJECTED leave request still
    // overlaps it (should probably be approved instead of counted absent).
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const approvedLeavesByEmp = new Map<string, { startDate: Date; endDate: Date }[]>();
    const otherLeavesByEmp = new Map<string, { startDate: Date; endDate: Date; status: string }[]>();
    for (const l of leaves) {
      const code = l.employee.employeeCode;
      if (l.status === "APPROVED") {
        const list = approvedLeavesByEmp.get(code) ?? [];
        list.push(l);
        approvedLeavesByEmp.set(code, list);
      } else if (l.status === "PENDING" || l.status === "REJECTED") {
        const list = otherLeavesByEmp.get(code) ?? [];
        list.push(l);
        otherLeavesByEmp.set(code, list);
      }
    }
    const recordedDays = new Set(recs.filter((r) => r.clockInAt).map((r) => `${r.employee.employeeCode}|${r.workDate.toISOString().slice(0, 10)}`));
    const DAY_MS = 86_400_000;
    for (const e of employees) {
      for (let d = new Date(start); d.getTime() < end.getTime(); d = new Date(d.getTime() + DAY_MS)) {
        const dow = d.getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const dIso = d.toISOString().slice(0, 10);
        if (holidaySet.has(dIso) || dIso >= todayIso) continue;
        if (recordedDays.has(`${e.employeeCode}|${dIso}`)) continue;
        const covered = (approvedLeavesByEmp.get(e.employeeCode) ?? []).some((l) => l.startDate.getTime() <= d.getTime() && d.getTime() <= l.endDate.getTime());
        if (covered) continue;
        const pendingOrRejected = (otherLeavesByEmp.get(e.employeeCode) ?? []).find((l) => l.startDate.getTime() <= d.getTime() && d.getTime() <= l.endDate.getTime());
        if (pendingOrRejected) {
          findings.push({
            date: formatDate(d), code: e.employeeCode, name: `${e.firstName} ${e.lastName}`, department: e.department?.name ?? "-",
            issueType: "ขาดงานแต่มีเอกสารลา",
            detail: `ไม่มีข้อมูลลงเวลา แต่มีใบลาสถานะ "${pendingOrRejected.status === "PENDING" ? "รออนุมัติ" : "ไม่อนุมัติ"}" ครอบคลุมวันนี้ — ตรวจสอบว่าควรอนุมัติหรือไม่`,
          });
        }
      }
    }

    for (const p of payrolls) {
      if (p.net < 0) {
        findings.push({
          date: label, code: p.employee.employeeCode, name: nameOf(p.employee), department: deptOf(p.employee),
          issueType: "เงินเดือนติดลบ", detail: `เงินเดือนสุทธิ ${p.net.toLocaleString("th-TH")} บาท — รายการหักเกินรายได้`,
        });
      }
    }

    findings.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
    const byType = new Map<string, number>();
    for (const f of findings) byType.set(f.issueType, (byType.get(f.issueType) ?? 0) + 1);

    return {
      title,
      period: label,
      footnote: `พบทั้งหมด ${findings.length} รายการที่ต้องตรวจสอบ`,
      columns: [
        { key: "date", label: "วันที่" },
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "department", label: "แผนก" },
        { key: "issueType", label: "ประเภทปัญหา" },
        { key: "detail", label: "รายละเอียด" },
      ],
      rows: findings,
      summary: toSummary(byType),
      summaryLabel: "จำนวนรายการตามประเภทปัญหา",
      summaryUnit: "รายการ",
    };
  }

  // training
  const enrollments = await prisma.trainingEnrollment.findMany({
    where: { companyId, status: { not: "CANCELLED" }, ...deptRel },
    select: {
      status: true,
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      course: { select: { hours: true } },
    },
  });
  const tmap = new Map<string, { name: string; enrolled: number; completed: number; hours: number }>();
  for (const e of enrollments) {
    const code = e.employee.employeeCode;
    const row = tmap.get(code) ?? { name: `${e.employee.firstName} ${e.employee.lastName}`, enrolled: 0, completed: 0, hours: 0 };
    row.enrolled += 1;
    if (e.status === "COMPLETED") {
      row.completed += 1;
      row.hours += e.course.hours;
    }
    tmap.set(code, row);
  }
  return {
    title,
    period: null,
    columns: [
      { key: "code", label: "รหัส" },
      { key: "name", label: "ชื่อ-สกุล" },
      { key: "enrolled", label: "ลงทะเบียน", numeric: true },
      { key: "completed", label: "เรียนจบ", numeric: true },
      { key: "hours", label: "ชั่วโมงสะสม", numeric: true },
    ],
    rows: [...tmap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
      code, name: v.name, enrolled: v.enrolled, completed: v.completed, hours: Math.round(v.hours * 10) / 10,
    })),
  };
}
