import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@db/index";
import { leaveRequests, leaveBalances } from "@db/schema";
import { requireSession, isSession, requireRole } from "@/lib/api-helpers";

const BALANCE_TYPES = new Set(["annual", "sick", "personal"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const roleErr = requireRole(session, ["manager", "hr"]);
  if (roleErr) return roleErr;

  const { id } = await ctx.params;
  const requestId = Number(id);
  const body = await req.json().catch(() => null);
  const action = body?.action as "approve" | "reject";
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action ต้องเป็น approve หรือ reject" }, { status: 400 });
  }

  const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, requestId)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });
  }
  if (existing.status !== "Pending") {
    return NextResponse.json({ error: "คำขอนี้ถูกดำเนินการไปแล้ว" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "Approved" : "Rejected";
  const [updated] = await db
    .update(leaveRequests)
    .set({ status: newStatus, approverId: session.employeeId, decidedAt: new Date() })
    .where(eq(leaveRequests.id, requestId))
    .returning();

  if (action === "approve" && BALANCE_TYPES.has(existing.type)) {
    const days = existing.dateFrom && existing.dateTo
      ? Math.max(
          1,
          Math.round(
            (new Date(existing.dateTo).getTime() - new Date(existing.dateFrom).getTime()) /
              86400000
          ) + 1
        )
      : 1;
    const usedDelta = existing.halfDay ? Math.ceil(days / 2) : days;
    const year = new Date().getFullYear() + 543;
    const [balance] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, existing.employeeId),
          eq(leaveBalances.leaveKey, existing.type),
          eq(leaveBalances.year, year)
        )
      )
      .limit(1);
    if (balance) {
      await db
        .update(leaveBalances)
        .set({ usedDays: balance.usedDays + usedDelta })
        .where(eq(leaveBalances.id, balance.id));
    }
  }

  return NextResponse.json({ ok: true, request: updated });
}
