import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { settingsSchema } from "@/features/appraisal-round/schema";
import { getSettings, saveSettings } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await getSettings(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

/** How scores are worked out and who sees what. Changes how people are scored, so it needs update rights and is audit-logged. */
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const input = settingsSchema.parse(await req.json().catch(() => ({})));
    return ok(await saveSettings(session.companyId, session, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
