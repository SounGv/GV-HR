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
  // Relation filter to scope record-based reports to one department.
  const deptRel = query.departmentId ? { employee: { departmentId: query.departmentId } } : {};

  if (query.type === "employees") {
    const emps = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, ...(query.departmentId ? { departmentId: query.departmentId } : {}) },
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
    const recs = await prisma.attendanceRecord.findMany({
      where: { companyId, deletedAt: null, workDate: { gte: start, lt: end }, ...deptRel },
      select: {
        status: true,
        clockInAt: true,
        clockOutAt: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
    });
    const map = new Map<string, { name: string; present: number; late: number; hours: number }>();
    const deptLate = new Map<string, number>();
    for (const r of recs) {
      const code = r.employee.employeeCode;
      const row = map.get(code) ?? { name: `${r.employee.firstName} ${r.employee.lastName}`, present: 0, late: 0, hours: 0 };
      if (r.clockInAt) row.present += 1;
      if (r.status === "LATE") {
        row.late += 1;
        bumpDept(deptLate, r.employee.department?.name, 1);
      }
      if (r.clockInAt && r.clockOutAt) row.hours += (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000;
      map.set(code, row);
    }
    return {
      title,
      period: label,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "present", label: "วันมาทำงาน", numeric: true },
        { key: "late", label: "วันมาสาย", numeric: true },
        { key: "hours", label: "ชั่วโมงรวม", numeric: true },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, present: v.present, late: v.late, hours: Math.round(v.hours * 10) / 10,
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
    const bals = await prisma.leaveBalance.findMany({
      where: { companyId, year, ...deptRel },
      select: {
        type: true,
        usedDays: true,
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
    });
    const map = new Map<string, { name: string; ANNUAL: number; SICK: number; PERSONAL: number }>();
    const deptDays = new Map<string, number>();
    for (const b of bals) {
      const code = b.employee.employeeCode;
      const row = map.get(code) ?? { name: `${b.employee.firstName} ${b.employee.lastName}`, ANNUAL: 0, SICK: 0, PERSONAL: 0 };
      if (b.type === "ANNUAL" || b.type === "SICK" || b.type === "PERSONAL") row[b.type] += b.usedDays;
      map.set(code, row);
      bumpDept(deptDays, b.employee.department?.name, b.usedDays);
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
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, annual: v.ANNUAL, sick: v.SICK, personal: v.PERSONAL,
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
        employee: {
          select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });
    const deptNet = new Map<string, number>();
    for (const p of prs) bumpDept(deptNet, p.employee.department?.name, Number(p.net));
    return {
      title,
      period,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "gross", label: "รายได้รวม", numeric: true },
        { key: "deductions", label: "รายการหัก", numeric: true },
        { key: "net", label: "สุทธิ", numeric: true },
        { key: "status", label: "สถานะ" },
      ],
      rows: prs.map((p) => ({
        code: p.employee.employeeCode,
        name: `${p.employee.firstName} ${p.employee.lastName}`,
        gross: p.gross,
        deductions: p.totalDeductions,
        net: p.net,
        status: p.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง",
      })),
      summary: toSummary(deptNet),
      summaryLabel: "เงินเดือนสุทธิรวมตามแผนก",
      summaryUnit: "บาท",
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
    const reviews = await prisma.performanceReview.findMany({
      where: { companyId, deletedAt: null, ...deptRel },
      select: {
        cycle: true,
        overallScore: true,
        band: true,
        createdAt: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const map = new Map<string, { name: string; cycle: string; score: number; band: string }>();
    for (const r of reviews) {
      const code = r.employee.employeeCode;
      if (map.has(code)) continue;
      map.set(code, { name: `${r.employee.firstName} ${r.employee.lastName}`, cycle: r.cycle, score: Math.round(r.overallScore * 10) / 10, band: r.band });
    }
    return {
      title,
      period: null,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "cycle", label: "รอบล่าสุด" },
        { key: "score", label: "คะแนนรวม", numeric: true },
        { key: "band", label: "ระดับ" },
      ],
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, v]) => ({
        code, name: v.name, cycle: v.cycle, score: v.score, band: v.band,
      })),
    };
  }

  if (query.type === "kpi") {
    const goals = await prisma.goal.findMany({
      where: { companyId, deletedAt: null, type: "KPI", ...deptRel },
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
