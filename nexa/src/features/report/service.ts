import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL } from "@/features/employee/labels";
import { ATTENDANCE_STATUS_LABEL, WORK_MODE_LABEL } from "@/features/attendance/status-badge";
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
    const [employees, recs, holidays, leaves, ots] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: "ACTIVE", ...employeeFilter },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      }),
      prisma.attendanceRecord.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          status: true,
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
        select: { startDate: true, endDate: true, days: true, employee: { select: { employeeCode: true } } },
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
      { name: string; present: number; late: number; hours: number; leave: number; earlyLeave: number; onsite: number; wfh: number; outside: number; otHours: number }
    >();
    for (const e of employees) {
      map.set(e.employeeCode, {
        name: `${e.firstName} ${e.lastName}`,
        present: 0, late: 0, hours: 0, leave: 0, earlyLeave: 0, onsite: 0, wfh: 0, outside: 0, otHours: 0,
      });
    }
    const deptLate = new Map<string, number>();
    for (const r of recs) {
      const row = map.get(r.employee.employeeCode);
      if (!row) continue; // e.g. an inactive employee's leftover record
      if (r.clockInAt) row.present += 1;
      if (r.status === "LATE") row.late += 1;
      if (r.earlyLeaveOut) row.earlyLeave += 1;
      if (r.clockInAt) {
        if (r.workMode === "WFH") row.wfh += 1;
        else if (r.workMode === "OUTSIDE") row.outside += 1;
        else row.onsite += 1;
      }
      if (r.clockInAt && r.clockOutAt) row.hours += (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000;
    }
    for (const l of leaves) {
      const row = map.get(l.employee.employeeCode);
      if (row) row.leave += clippedDays(l.startDate, l.endDate, l.days);
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
        { key: "leave", label: "วันลา", numeric: true },
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
        leave: Math.round(v.leave * 10) / 10,
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
    const [recs, branches] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
        select: {
          workDate: true,
          clockInAt: true,
          clockOutAt: true,
          status: true,
          workMode: true,
          clockInBranchId: true,
          clockInDistance: true,
          employee: { select: { employeeCode: true, firstName: true, lastName: true } },
        },
        orderBy: [{ workDate: "desc" }, { employee: { employeeCode: "asc" } }],
        take: 1000,
      }),
      prisma.branch.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);
    const branchName = new Map(branches.map((b) => [b.id, b.name]));
    const fmtTime = (d: Date | null) =>
      d
        ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(d)
        : "-";
    return {
      title,
      period: label,
      columns: [
        { key: "date", label: "วันที่" },
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "clockIn", label: "เวลาเข้า" },
        { key: "clockOut", label: "เวลาออก" },
        { key: "status", label: "สถานะ" },
        { key: "workMode", label: "รูปแบบงาน" },
        { key: "location", label: "สถานที่" },
        { key: "distance", label: "ระยะห่าง (ม.)", numeric: true },
      ],
      rows: recs.map((r) => ({
        date: formatDate(r.workDate),
        code: r.employee.employeeCode,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        clockIn: fmtTime(r.clockInAt),
        clockOut: fmtTime(r.clockOutAt),
        status: ATTENDANCE_STATUS_LABEL[r.status] ?? r.status,
        workMode: WORK_MODE_LABEL[r.workMode] ?? r.workMode,
        location: r.clockInBranchId ? branchName.get(r.clockInBranchId) ?? "-" : "-",
        distance: r.clockInDistance != null ? Math.round(r.clockInDistance) : "-",
      })),
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
    const ots = await prisma.overtimeRequest.findMany({
      where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: start, lt: end }, ...deptRel },
      select: {
        hours: true,
        estimatedAmount: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
    });
    const map = new Map<string, { name: string; hours: number; amount: number }>();
    const deptHours = new Map<string, number>();
    for (const o of ots) {
      const code = o.employee.employeeCode;
      const row = map.get(code) ?? { name: `${o.employee.firstName} ${o.employee.lastName}`, hours: 0, amount: 0 };
      row.hours += o.hours;
      row.amount += o.estimatedAmount;
      map.set(code, row);
      bumpDept(deptHours, o.employee.department?.name, o.hours);
    }
    return {
      title,
      period: label,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "hours", label: "ชั่วโมง OT", numeric: true },
        { key: "amount", label: "ค่าล่วงเวลา (บาท)", numeric: true },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, hours: Math.round(v.hours * 10) / 10, amount: v.amount,
      })),
      summary: toSummary(deptHours),
      summaryLabel: "ชั่วโมง OT รวมตามแผนก",
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
    // but per employee — everything else (allowances/OT/bonus/other manual
    // adjustments) stays folded into the existing gross/deductions totals
    // rather than exploding into one column per possible label.
    const lineAmount = (lines: { label: string; amount: number }[], label: string) =>
      lines.find((l) => l.label === label)?.amount ?? 0;

    return {
      title,
      period,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "gross", label: "รายได้รวม", numeric: true },
        { key: "socialSecurity", label: "ประกันสังคม", numeric: true },
        { key: "withholdingTax", label: "ภาษีหัก ณ ที่จ่าย", numeric: true },
        { key: "unpaidLeave", label: "หักลาไม่รับค่าจ้าง", numeric: true },
        { key: "deductions", label: "รายการหักรวม", numeric: true },
        { key: "net", label: "สุทธิ", numeric: true },
        { key: "status", label: "สถานะ" },
      ],
      rows: prs.map((p) => {
        const lines = (p.deductions as unknown as { label: string; amount: number }[] | null) ?? [];
        return {
          code: p.employee.employeeCode,
          name: `${p.employee.firstName} ${p.employee.lastName}`,
          gross: p.gross,
          socialSecurity: lineAmount(lines, "ประกันสังคม"),
          withholdingTax: lineAmount(lines, "ภาษีหัก ณ ที่จ่าย"),
          unpaidLeave: lineAmount(lines, "หักลาไม่รับค่าจ้าง"),
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
    const claims = await prisma.expenseClaim.findMany({
      where: { companyId, deletedAt: null, status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: start, lt: end }, ...deptRel },
      select: {
        amount: true,
        status: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
    });
    const map = new Map<string, { name: string; count: number; approved: number; paid: number }>();
    const deptApproved = new Map<string, number>();
    for (const c of claims) {
      const code = c.employee.employeeCode;
      const row = map.get(code) ?? { name: `${c.employee.firstName} ${c.employee.lastName}`, count: 0, approved: 0, paid: 0 };
      const amt = Number(c.amount);
      row.count += 1;
      row.approved += amt;
      if (c.status === "PAID") row.paid += amt;
      map.set(code, row);
      bumpDept(deptApproved, c.employee.department?.name, amt);
    }
    return {
      title,
      period: label,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "count", label: "จำนวนรายการ", numeric: true },
        { key: "approved", label: "อนุมัติรวม (บาท)", numeric: true },
        { key: "paid", label: "จ่ายแล้ว (บาท)", numeric: true },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, count: v.count, approved: Math.round(v.approved * 100) / 100, paid: Math.round(v.paid * 100) / 100,
      })),
      summary: toSummary(deptApproved),
      summaryLabel: "ค่าใช้จ่ายอนุมัติรวมตามแผนก",
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
