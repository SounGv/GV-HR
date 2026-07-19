import { NextResponse } from "next/server";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@db/index";
import { employees, performanceRecords } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["manager", "hr"]);
  if (roleErr) return roleErr;

  const rows = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      name: employees.name,
      department: employees.department,
      role: employees.role,
    })
    .from(employees)
    .where(ne(employees.id, session.employeeId));

  const withPerf = await Promise.all(
    rows.map(async (e) => {
      const [perf] = await db
        .select()
        .from(performanceRecords)
        .where(eq(performanceRecords.employeeId, e.id))
        .orderBy(desc(performanceRecords.createdAt))
        .limit(1);
      const scores = perf
        ? (perf.kpis as { label: string; score: number }[])
            .map((k) => `${k.label.split(" ")[0]} ${k.score}/5`)
            .join(", ")
        : "ยังไม่มีข้อมูลผลงาน";
      return { ...e, scores };
    })
  );

  return NextResponse.json({ employees: withPerf });
}
