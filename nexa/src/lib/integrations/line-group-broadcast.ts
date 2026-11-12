import { prisma } from "@/lib/prisma";
import { runAfterResponse } from "@/lib/after-response";
import { shouldPushToLine } from "@/features/notification/line-policy";
import { sendLinePush } from "./line";

/**
 * ส่งข้อความเข้าทุกกลุ่ม LINE ของบริษัทที่ตรงกับ purpose (เช่น "hr-alerts")
 * และยัง active อยู่ — ทีละกลุ่ม ไม่ Promise.all (เหตุผลเดียวกับ sendBulkNotification
 * ใน notification/service.ts: connection pool จำกัด)
 *
 * Swallows its own errors (never throws) — callers like createLeave/
 * createOvertime await this after their real work is already done, so a
 * DB hiccup on this table must never fail the leave/OT request itself,
 * same "best-effort, non-blocking" contract pushLineGroupMessage already
 * has for the actual LINE API call.
 *
 * Posts go through the company's own LINE account (GV Attendance) only. The
 * gv-api-gateway route through GV BOT was removed on 2026-11-12 (owner's call):
 * GV BOT stays with gv-ops-bot, not HR.
 */
export async function broadcastToLineGroups(
  companyId: string,
  purpose: string,
  text: string,
  /** Notification category of the post; only categories in LINE_CATEGORIES go out (see line-policy.ts). */
  topic: string,
): Promise<void> {
  if (!shouldPushToLine(topic)) return;
  try {
    const groups = await prisma.lineGroupTarget.findMany({
      where: { companyId, purpose, active: true },
      select: { groupId: true },
    });

    if (groups.length === 0) return;
    await runAfterResponse(async () => {
      for (const g of groups) {
        await sendLinePush(g.groupId, text);
      }
    });
  } catch (err) {
    console.error("[line] broadcastToLineGroups failed:", err);
  }
}
