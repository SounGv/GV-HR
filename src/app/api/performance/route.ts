import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@db/index";
import { performanceRecords } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const employeeIdParam = new URL(req.url).searchParams.get("employeeId");
  const employeeId =
    employeeIdParam && (session.role === "hr" || session.role === "manager")
      ? Number(employeeIdParam)
      : session.employeeId;

  const [record] = await db
    .select()
    .from(performanceRecords)
    .where(eq(performanceRecords.employeeId, employeeId))
    .orderBy(desc(performanceRecords.createdAt))
    .limit(1);

  return NextResponse.json({ performance: record || null });
}
