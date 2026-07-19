import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@db/index";
import { attendanceRecords } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";
import { todayISOBangkok } from "@/lib/date";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const today = todayISOBangkok();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  const [todayRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(eq(attendanceRecords.employeeId, session.employeeId), eq(attendanceRecords.workDate, today))
    )
    .limit(1);

  const history = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, session.employeeId),
        gte(attendanceRecords.workDate, sinceISO)
      )
    )
    .orderBy(desc(attendanceRecords.workDate));

  return NextResponse.json({ today: todayRecord || null, history });
}
