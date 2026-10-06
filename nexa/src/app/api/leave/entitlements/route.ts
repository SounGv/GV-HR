import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { listEntitlements, setEntitlement } from "@/features/leave/entitlement-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

const listQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100), q: z.string().max(100).optional() });
const setBody = z.object({
  employeeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  type: z.enum(["SICK", "PERSONAL", "ANNUAL"]),
  totalDays: z.coerce.number().min(0).max(365),
});

/** Paid-leave entitlements of everyone for one year. HR only. */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("employee:update");
    const q = listQuery.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    return ok(await listEntitlements(session.companyId, q.year, q.q));
  } catch (err) {
    return handleApiError(err);
  }
}

/** Sets one person's entitlement for one type and year; usage is not touched. HR only, audit-logged. */
export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("employee:update");
    const body = setBody.parse(await req.json().catch(() => ({})));
    return ok(await setEntitlement(session.companyId, session, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
