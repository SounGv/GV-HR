import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { swapRequestCreateSchema, swapRequestListQuerySchema } from "@/features/shift/schema";
import { createSwapRequest, listSwapRequests } from "@/features/shift/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("shift:read");
    const { scope } = swapRequestListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const records = await listSwapRequests(session.companyId, session, scope);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("shift:read");
    const input = swapRequestCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createSwapRequest(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
