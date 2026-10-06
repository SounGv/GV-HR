import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { applyRollover, previewRollover } from "@/features/leave/year-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

const preview = z.object({
  fromYear: z.coerce.number().int(),
  toYear: z.coerce.number().int(),
  carryAnnualCap: z.coerce.number().min(0).max(60).default(0),
});
const apply = preview.extend({ expectedInsert: z.coerce.number().int().min(0) });

/** DryRun for setting up next year's leave entitlements from this year's. Reads only. HR only. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("employee:update");
    const q = preview.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    return ok(await previewRollover(session.companyId, q.fromYear, q.toYear, q.carryAnnualCap));
  } catch (err) {
    return handleApiError(err);
  }
}

/** Creates the new year's rows (only ones that do not exist yet) after the preview was checked. HR only. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("employee:update");
    const body = apply.parse(await req.json().catch(() => ({})));
    return ok(await applyRollover(session.companyId, session, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
