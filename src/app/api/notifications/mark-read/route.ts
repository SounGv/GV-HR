import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@db/index";
import { notifications } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function POST() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.employeeId, session.employeeId));

  return NextResponse.json({ ok: true });
}
