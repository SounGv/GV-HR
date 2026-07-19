import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@db/index";
import { notifications } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.employeeId, session.employeeId))
    .orderBy(desc(notifications.createdAt));

  return NextResponse.json({ notifications: rows });
}
