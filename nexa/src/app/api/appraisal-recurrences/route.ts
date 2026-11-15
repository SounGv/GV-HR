import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { recurrenceSchema } from "@/features/appraisal-round/schema";
import { createRecurrence, listRecurrences } from "@/features/appraisal-round/recurrence-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** The recurring-round setups with the next rounds each will make. HR only (`campaign:update`). */
export async function GET() {
  try {
    const session = await requirePermission("campaign:update");
    return ok(await listRecurrences(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const body = recurrenceSchema.parse(await req.json());
    return ok(await createRecurrence(session.companyId, session, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
