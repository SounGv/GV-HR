import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@db/index";
import { attendanceRecords } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";
import { todayISOBangkok } from "@/lib/date";
import { isWithinOffice } from "@/lib/geo";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "ไม่พบพิกัด GPS กรุณาอนุญาตการเข้าถึงตำแหน่ง" }, { status: 400 });
  }
  if (!isWithinOffice(lat, lng)) {
    return NextResponse.json({ error: "คุณอยู่นอกพื้นที่สำนักงาน ไม่สามารถลงเวลาได้" }, { status: 422 });
  }

  const today = todayISOBangkok();
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(eq(attendanceRecords.employeeId, session.employeeId), eq(attendanceRecords.workDate, today))
    )
    .limit(1);

  if (!existing?.clockInAt) {
    return NextResponse.json({ error: "คุณยังไม่ได้ลงเวลาเข้างานวันนี้" }, { status: 409 });
  }
  if (existing.clockOutAt) {
    return NextResponse.json({ error: "คุณลงเวลาออกงานวันนี้แล้ว" }, { status: 409 });
  }

  const [record] = await db
    .update(attendanceRecords)
    .set({ clockOutAt: new Date(), clockOutLat: lat, clockOutLng: lng })
    .where(eq(attendanceRecords.id, existing.id))
    .returning();

  return NextResponse.json({ ok: true, record });
}
