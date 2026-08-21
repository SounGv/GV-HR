import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";
import { sendNotificationSchema } from "@/features/notification/schema";
import { sendBulkNotification } from "@/features/notification/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("notification:create");
    const input = sendNotificationSchema.parse(await req.json().catch(() => ({})));
    const result = await sendBulkNotification(session.companyId, session, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
