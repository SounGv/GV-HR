import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@db/index";
import { employees } from "@db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  }

  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, session.employeeId))
    .limit(1);

  if (!emp) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 401 });
  }

  return NextResponse.json({
    id: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    department: emp.department,
    position: emp.position,
    managerId: emp.managerId,
    phone: emp.phone,
    startDate: emp.startDate,
  });
}
