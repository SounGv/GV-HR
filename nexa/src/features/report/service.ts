import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL } from "@/features/employee/labels";
import { REPORT_LABELS, type ReportQuery } from "./schema";

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}
export interface ReportResult {
  title: string;
  period: string | null;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
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
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; present: number; late: number; hours: number }>();
    for (const r of recs) {
      const code = r.employee.employeeCode;
      const row = map.get(code) ?? { name: `${r.employee.firstName} ${r.employee.lastName}`, present: 0, late: 0, hours: 0 };
      if (r.clockInAt) row.present += 1;
      if (r.status === "LATE") row.late += 1;
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
    };
  }

  if (query.type === "leave") {
    const year = start.getUTCFullYear();
    const bals = await prisma.leaveBalance.findMany({
      where: { companyId, year, ...deptRel },
      select: {
        type: true,
        usedDays: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; ANNUAL: number; SICK: number; PERSONAL: number }>();
    for (const b of bals) {
      const code = b.employee.employeeCode;
      const row = map.get(code) ?? { name: `${b.employee.firstName} ${b.employee.lastName}`, ANNUAL: 0, SICK: 0, PERSONAL: 0 };
      if (b.type === "ANNUAL" || b.type === "SICK" || b.type === "PERSONAL") row[b.type] += b.usedDays;
      map.set(code, row);
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
    };
  }

  if (query.type === "overtime") {
    const ots = await prisma.overtimeRequest.findMany({
      where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: start, lt: end }, ...deptRel },
      select: {
        hours: true,
        estimatedAmount: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; hours: number; amount: number }>();
    for (const o of ots) {
      const code = o.employee.employeeCode;
      const row = map.get(code) ?? { name: `${o.employee.firstName} ${o.employee.lastName}`, hours: 0, amount: 0 };
      row.hours += o.hours;
      row.amount += o.estimatedAmount;
      map.set(code, row);
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
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });
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
    };
  }

  if (query.type === "expense") {
    const claims = await prisma.expenseClaim.findMany({
      where: { companyId, deletedAt: null, status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: start, lt: end }, ...deptRel },
      select: {
        amount: true,
        status: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; count: number; approved: number; paid: number }>();
    for (const c of claims) {
      const code = c.employee.employeeCode;
      const row = map.get(code) ?? { name: `${c.employee.firstName} ${c.employee.lastName}`, count: 0, approved: 0, paid: 0 };
      const amt = Number(c.amount);
      row.count += 1;
      row.approved += amt;
      if (c.status === "PAID") row.paid += amt;
      map.set(code, row);
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
