import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { reviewUpdateSchema } from "@/features/performance/schema";
import { getReview, updateReview } from "@/features/performance/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("performance:read");
    const { id } = await params;
    const record = await getReview(session.companyId, session, id);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("performance:update");
    const { id } = await params;
    const input = reviewUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateReview(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
