import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@db/index";
import { leaveRequests, employees } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";
import { thDate, computeOtHours } from "@/lib/format";

const leaveTypeName: Record<string, string> = {
  annual: "ลาพักร้อน",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  unpaid: "ลาไม่รับค่าจ้าง",
  ot: "ทำงานล่วงเวลา",
  correction: "ขอแก้ไขเวลา",
};

export async function GET(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const scope = new URL(req.url).searchParams.get("scope") || "mine";

  let employeeIds: number[];
  if (scope === "team" && (session.role === "manager" || session.role === "hr")) {
    const reports = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.managerId, session.employeeId));
    employeeIds = reports.map((r) => r.id);
  } else if (scope === "all" && session.role === "hr") {
    const all = await db.select({ id: employees.id }).from(employees);
    employeeIds = all.map((r) => r.id);
  } else {
    employeeIds = [session.employeeId];
  }

  if (employeeIds.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const rows = await db
    .select({
      id: leaveRequests.id,
      requestCode: leaveRequests.requestCode,
      type: leaveRequests.type,
      dateFrom: leaveRequests.dateFrom,
      dateTo: leaveRequests.dateTo,
      halfDay: leaveRequests.halfDay,
      otStartTime: leaveRequests.otStartTime,
      otEndTime: leaveRequests.otEndTime,
      otHours: leaveRequests.otHours,
      reason: leaveRequests.reason,
      attachmentUrl: leaveRequests.attachmentUrl,
      status: leaveRequests.status,
      submittedAt: leaveRequests.submittedAt,
      decidedAt: leaveRequests.decidedAt,
      employeeId: leaveRequests.employeeId,
      employeeName: employees.name,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(inArray(leaveRequests.employeeId, employeeIds))
    .orderBy(desc(leaveRequests.submittedAt));

  const result = rows.map((r) => {
    let dateLabel = r.dateFrom ? thDate(r.dateFrom) : "วันนี้";
    if (r.dateTo && r.dateTo !== r.dateFrom) dateLabel += "–" + thDate(r.dateTo);
    const sub =
      r.type === "ot"
        ? `${r.otHours ?? 0} ชม. (${r.otStartTime || "--:--"}–${r.otEndTime || "--:--"})`
        : r.halfDay
          ? "ครึ่งวัน"
          : "1 วัน";
    return {
      id: r.id,
      requestCode: r.requestCode,
      type: leaveTypeName[r.type] || r.type,
      key: r.type,
      dateLabel,
      sub,
      status: r.status,
      submitted: r.submittedAt,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      reason: r.reason,
      attachmentUrl: r.attachmentUrl,
    };
  });

  return NextResponse.json({ requests: result });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  const type = body?.type as string;
  if (!type || !(type in leaveTypeName)) {
    return NextResponse.json({ error: "กรุณาเลือกประเภทคำขอ" }, { status: 400 });
  }

  const requestCode = "REQ-" + Date.now().toString().slice(-6);

  const [emp] = await db.select().from(employees).where(eq(employees.id, session.employeeId)).limit(1);

  const isOt = type === "ot";
  const otStartTime = isOt ? body.otStartTime || null : null;
  const otEndTime = isOt ? body.otEndTime || null : null;
  const otHours = isOt && otStartTime && otEndTime ? computeOtHours(otStartTime, otEndTime) : null;

  const [req_] = await db
    .insert(leaveRequests)
    .values({
      requestCode,
      employeeId: session.employeeId,
      type: type as never,
      dateFrom: body.dateFrom || null,
      dateTo: body.dateTo || body.dateFrom || null,
      halfDay: !!body.halfDay,
      otStartTime,
      otEndTime,
      otHours,
      reason: body.reason || "",
      attachmentUrl: body.attachmentUrl || null,
      approverId: emp?.managerId || null,
    })
    .returning();

  return NextResponse.json({ ok: true, request: req_ });
}
