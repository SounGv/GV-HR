import { prisma } from "@/lib/prisma";
import { runAfterResponse } from "@/lib/after-response";
import { shouldPushToLine } from "@/features/notification/line-policy";
import { sendLinePush } from "./line";
import { pushViaGateway, readGatewayConfig } from "./line-gateway";

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
  /** Notification category of the post; only categories in LINE_CATEGORIES go out (see line-policy.ts). */
  topic: string,
): Promise<void> {
  if (!shouldPushToLine(topic)) return;
  try {
    const groups = await prisma.lineGroupTarget.findMany({
      where: { companyId, purpose, active: true },
      select: { groupId: true },
    });

    // HR alerts go through gv-api-gateway (the paid bot) when it is set up. A company still has to have at
    // least one active group row, which is what keeps a demo company's requests out of the real group.
    // The ids to post to come from GV_GATEWAY_LINE_GROUP_IDS because a group id belongs to one bot.
    const gateway = purpose === "hr-alerts" ? readGatewayConfig() : null;
    if (gateway) {
      if (groups.length === 0) return;
      if (gateway.groupIds.length === 0) {
        console.error("[line-gateway] GV_GATEWAY_LINE_GROUP_IDS is empty: group alert not sent");
        return;
      }
      // Sent after the response: a check-in or a leave request never waits on LINE.
      await runAfterResponse(async () => {
        for (const to of gateway.groupIds) {
          await pushViaGateway(gateway, to, text);
        }
      });
      return;
    }

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
