import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./auth";

export async function requireSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  }
  return session;
}

export function isSession(v: SessionPayload | NextResponse): v is SessionPayload {
  return !(v instanceof NextResponse);
}

export function requireRole(session: SessionPayload, roles: SessionPayload["role"][]): NextResponse | null {
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }
  return null;
}
