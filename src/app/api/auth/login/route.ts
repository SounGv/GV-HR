import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db } from "@db/index";
import { employees } from "@db/schema";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const identifier = (body?.identifier || "").trim();
  const password = body?.password || "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "กรุณากรอกรหัสพนักงาน/อีเมล และรหัสผ่าน" }, { status: 400 });
  }

  const [emp] = await db
    .select()
    .from(employees)
    .where(or(eq(employees.email, identifier), eq(employees.employeeCode, identifier)))
    .limit(1);

  if (!emp) {
    return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้นี้" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, emp.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const token = await createSessionToken({
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    role: emp.role,
    department: emp.department,
    position: emp.position,
    managerId: emp.managerId,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
