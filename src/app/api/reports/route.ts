import { NextResponse } from "next/server";
import { eq, gte } from "drizzle-orm";
import { db } from "@db/index";
import { attendanceRecords, employees, leaveRequests, payrollRecords } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";

type Tab = "attendance" | "leave" | "finance";

function fmtBaht(n: number) {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return "฿" + (n / 1000).toFixed(1) + "K";
  return "฿" + n.toLocaleString("en-US");
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["manager", "hr"]);
  if (roleErr) return roleErr;

  const tab = (new URL(req.url).searchParams.get("tab") || "attendance") as Tab;

  const allEmployees = await db
    .select({ id: employees.id, department: employees.department })
    .from(employees);
  const deptOf = new Map(allEmployees.map((e) => [e.id, e.department]));

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  if (tab === "attendance") {
    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(gte(attendanceRecords.workDate, sinceISO));

    const perDept = new Map<string, { total: number; present: number; late: number; absent: number }>();
    let late = 0;
    let absent = 0;
    for (const r of rows) {
      const dept = deptOf.get(r.employeeId) || "อื่นๆ";
      const bucket = perDept.get(dept) || { total: 0, present: 0, late: 0, absent: 0 };
      bucket.total += 1;
      if (!r.clockInAt) {
        bucket.absent += 1;
        absent += 1;
      } else {
        bucket.present += 1;
        const h = new Date(r.clockInAt).getHours();
        const m = new Date(r.clockInAt).getMinutes();
        if (h > 9 || (h === 9 && m > 0)) {
          bucket.late += 1;
          late += 1;
        }
      }
      perDept.set(dept, bucket);
    }

    const otApproved = await db.select().from(leaveRequests).where(eq(leaveRequests.type, "ot"));
    const otHours = otApproved.filter((r) => r.status === "Approved").length * 3;

    const totalRecords = rows.length || 1;
    const presentTotal = rows.filter((r) => r.clockInAt).length;

    return NextResponse.json({
      title: "อัตราการมาทำงานตามแผนก",
      updated: "30 วันล่าสุด",
      cards: [
        { label: "อัตรามาทำงาน", value: Math.round((presentTotal / totalRecords) * 100) + "%", color: "#0f9d6e" },
        { label: "มาสาย", value: late + " ครั้ง", color: "#f59e0b" },
        { label: "ขาดงาน", value: absent + " ครั้ง", color: "#ef4444" },
        { label: "ชั่วโมง OT", value: otHours + " ชม.", color: "#17181c" },
      ],
      rows: Array.from(perDept.entries())
        .map(([name, b]) => ({
          name,
          val: Math.round((b.present / b.total) * 100) + "%",
          p: Math.round((b.present / b.total) * 100),
        }))
        .sort((a, b) => b.p - a.p),
    });
  }

  if (tab === "leave") {
    const rows = await db.select().from(leaveRequests);
    const approved = rows.filter((r) => r.status === "Approved");
    const dayCount = (r: (typeof rows)[number]) => {
      if (!r.dateFrom) return r.halfDay ? 0.5 : 1;
      const to = r.dateTo || r.dateFrom;
      const days = Math.round((new Date(to).getTime() - new Date(r.dateFrom).getTime()) / 86400000) + 1;
      return r.halfDay ? days / 2 : days;
    };

    const perDept = new Map<string, number>();
    let totalDays = 0;
    let annualDays = 0;
    let sickDays = 0;
    for (const r of approved) {
      const days = dayCount(r);
      totalDays += days;
      if (r.type === "annual") annualDays += days;
      if (r.type === "sick") sickDays += days;
      const dept = deptOf.get(r.employeeId) || "อื่นๆ";
      perDept.set(dept, (perDept.get(dept) || 0) + days);
    }
    const pendingCount = rows.filter((r) => r.status === "Pending").length;
    const maxDept = Math.max(1, ...Array.from(perDept.values()));

    return NextResponse.json({
      title: "จำนวนวันลาตามแผนก",
      updated: "ปีปัจจุบัน",
      cards: [
        { label: "วันลารวม", value: totalDays + " วัน", color: "#3a3c46" },
        { label: "ลาพักร้อน", value: annualDays + " วัน", color: "#17181c" },
        { label: "ลาป่วย", value: sickDays + " วัน", color: "#0f9d6e" },
        { label: "รออนุมัติ", value: pendingCount + " คำขอ", color: "#f59e0b" },
      ],
      rows: Array.from(perDept.entries())
        .map(([name, days]) => ({ name, val: days + " วัน", p: Math.round((days / maxDept) * 100) }))
        .sort((a, b) => b.p - a.p),
    });
  }

  // finance
  const latestPeriodRows = await db.select().from(payrollRecords);
  const periods = Array.from(new Set(latestPeriodRows.map((r) => r.period))).sort();
  const latestPeriod = periods[periods.length - 1];
  const latest = latestPeriodRows.filter((r) => r.period === latestPeriod);

  const perDept = new Map<string, number>();
  let totalPayroll = 0;
  let otCost = 0;
  let bonusCost = 0;
  for (const r of latest) {
    totalPayroll += r.net;
    const dept = deptOf.get(r.employeeId) || "อื่นๆ";
    perDept.set(dept, (perDept.get(dept) || 0) + r.net);
    for (const e of r.earnings as { label: string; amt: number }[]) {
      if (e.label.includes("OT")) otCost += e.amt;
      if (e.label.includes("เบี้ยขยัน") || e.label.includes("โบนัส")) bonusCost += e.amt;
    }
  }
  const avgSalary = latest.length ? Math.round(totalPayroll / latest.length) : 0;
  const maxDept = Math.max(1, ...Array.from(perDept.values()));

  return NextResponse.json({
    title: "ต้นทุนค่าจ้างตามแผนก",
    updated: latestPeriod ? `งวด ${latestPeriod}` : "-",
    cards: [
      { label: "ค่าจ้างรวม", value: fmtBaht(totalPayroll), color: "#0f766e" },
      { label: "ค่า OT", value: fmtBaht(otCost), color: "#17181c" },
      { label: "โบนัส/เบี้ย", value: fmtBaht(bonusCost), color: "#f59e0b" },
      { label: "เงินเดือนเฉลี่ย", value: fmtBaht(avgSalary), color: "#0f9d6e" },
    ],
    rows: Array.from(perDept.entries())
      .map(([name, amt]) => ({ name, val: fmtBaht(amt), p: Math.round((amt / maxDept) * 100) }))
      .sort((a, b) => b.p - a.p),
  });
}
