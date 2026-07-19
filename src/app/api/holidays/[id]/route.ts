import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@db/index";
import { holidays } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["hr"]);
  if (roleErr) return roleErr;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const [row] = await db
    .update(holidays)
    .set({ notifyEnabled: !!body?.notifyEnabled })
    .where(eq(holidays.id, Number(id)))
    .returning();

  if (!row) return NextResponse.json({ error: "ไม่พบวันหยุดนี้" }, { status: 404 });
  return NextResponse.json({ ok: true, holiday: row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["hr"]);
  if (roleErr) return roleErr;

  const { id } = await ctx.params;
  await db.delete(holidays).where(eq(holidays.id, Number(id)));
  return NextResponse.json({ ok: true });
}
