import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL } from "@/features/employee/labels";
import { REPORT_LABELS, type ReportType } from "./schema";

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

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYear(): string {
  return String(new Date().getFullYear());
}
function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

export async function getReport(
  companyId: string,
  type: ReportType,
  periodInput?: string,
): Promise<ReportResult> {
  const title = REPORT_LABELS[type];

  if (type === "employees") {
    const emps = await prisma.employee.findMany({
      where: { companyId, deletedAt: null },
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

  if (type === "attendance") {
    const period = periodInput || currentMonth();
    const { from, to } = monthRange(period);
    const recs = await prisma.attendanceRecord.findMany({
      where: { companyId, deletedAt: null, workDate: { gte: from, lt: to } },
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
      const row = map.get(code) ?? {
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        present: 0,
        late: 0,
        hours: 0,
      };
      if (r.clockInAt) row.present += 1;
      if (r.status === "LATE") row.late += 1;
      if (r.clockInAt && r.clockOutAt) {
        row.hours += (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000;
      }
      map.set(code, row);
    }
    return {
      title,
      period,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "present", label: "วันมาทำงาน", numeric: true },
        { key: "late", label: "วันมาสาย", numeric: true },
        { key: "hours", label: "ชั่วโมงรวม", numeric: true },
      ],
      rows: [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, v]) => ({
          code,
          name: v.name,
          present: v.present,
          late: v.late,
          hours: Math.round(v.hours * 10) / 10,
        })),
    };
  }

  if (type === "leave") {
    const year = Number(periodInput || currentYear());
    const bals = await prisma.leaveBalance.findMany({
      where: { companyId, year },
      select: {
        type: true,
        usedDays: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; ANNUAL: number; SICK: number; PERSONAL: number }>();
    for (const b of bals) {
      const code = b.employee.employeeCode;
      const row = map.get(code) ?? {
        name: `${b.employee.firstName} ${b.employee.lastName}`,
        ANNUAL: 0,
        SICK: 0,
        PERSONAL: 0,
      };
      if (b.type === "ANNUAL" || b.type === "SICK" || b.type === "PERSONAL") {
        row[b.type] += b.usedDays;
      }
      map.set(code, row);
    }
    return {
      title,
      period: String(year),
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "annual", label: "ลาพักร้อน (วัน)", numeric: true },
        { key: "sick", label: "ลาป่วย (วัน)", numeric: true },
        { key: "personal", label: "ลากิจ (วัน)", numeric: true },
      ],
      rows: [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, v]) => ({
          code,
          name: v.name,
          annual: v.ANNUAL,
          sick: v.SICK,
          personal: v.PERSONAL,
        })),
    };
  }

  if (type === "overtime") {
    const period = periodInput || currentMonth();
    const { from, to } = monthRange(period);
    const ots = await prisma.overtimeRequest.findMany({
      where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: from, lt: to } },
      select: {
        hours: true,
        estimatedAmount: true,
        employee: { select: { employeeCode: true, firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { name: string; hours: number; amount: number }>();
    for (const o of ots) {
      const code = o.employee.employeeCode;
      const row = map.get(code) ?? {
        name: `${o.employee.firstName} ${o.employee.lastName}`,
        hours: 0,
        amount: 0,
      };
      row.hours += o.hours;
      row.amount += o.estimatedAmount;
      map.set(code, row);
    }
    return {
      title,
      period,
      columns: [
        { key: "code", label: "รหัส" },
        { key: "name", label: "ชื่อ-สกุล" },
        { key: "hours", label: "ชั่วโมง OT", numeric: true },
        { key: "amount", label: "ค่าล่วงเวลา (บาท)", numeric: true },
      ],
      rows: [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([code, v]) => ({
          code,
          name: v.name,
          hours: Math.round(v.hours * 10) / 10,
          amount: v.amount,
        })),
    };
  }

  // payroll
  const period = periodInput || currentMonth();
  const prs = await prisma.payrollRecord.findMany({
    where: { companyId, deletedAt: null, period },
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
