import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@db/index";
import { holidays } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const rows = await db.select().from(holidays).orderBy(asc(holidays.dateISO));
  return NextResponse.json({ holidays: rows });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["hr"]);
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.dateISO) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและวันที่" }, { status: 400 });
  }

  const [row] = await db
    .insert(holidays)
    .values({
      dateISO: body.dateISO,
      name: body.name,
      type: body.type === "national" ? "national" : "company",
      notifyEnabled: body.notifyEnabled !== false,
      createdBy: session.employeeId,
    })
    .returning();

  return NextResponse.json({ ok: true, holiday: row });
}
