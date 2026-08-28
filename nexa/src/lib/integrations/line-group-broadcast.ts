import { prisma } from "@/lib/prisma";
import { pushLineGroupMessage } from "./line";

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
 */
export async function broadcastToLineGroups(
  companyId: string,
  purpose: string,
  text: string,
): Promise<void> {
  try {
    const groups = await prisma.lineGroupTarget.findMany({
      where: { companyId, purpose, active: true },
      select: { groupId: true },
    });
    for (const g of groups) {
      await pushLineGroupMessage(g.groupId, text);
    }
  } catch (err) {
    console.error("[line] broadcastToLineGroups failed:", err);
  }
}
