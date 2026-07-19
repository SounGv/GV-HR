import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@db/index";
import { leaveBalances } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const year = new Date().getFullYear() + 543;
  const rows = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.employeeId, session.employeeId), eq(leaveBalances.year, year)));

  const balances = rows.map((b) => ({
    key: b.leaveKey,
    label: b.label,
    total: b.totalDays,
    used: b.usedDays,
    remain: b.totalDays - b.usedDays,
  }));

  return NextResponse.json({ balances });
}
