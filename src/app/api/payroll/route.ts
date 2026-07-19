import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@db/index";
import { payrollRecords } from "@db/schema";
import { requireSession, isSession } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const rows = await db
    .select()
    .from(payrollRecords)
    .where(eq(payrollRecords.employeeId, session.employeeId))
    .orderBy(desc(payrollRecords.period));

  return NextResponse.json({ payroll: rows });
}
