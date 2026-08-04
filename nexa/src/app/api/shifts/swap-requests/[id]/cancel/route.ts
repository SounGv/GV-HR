import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cancelSwapRequest } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("shift:read");
    const { id } = await params;
    const record = await cancelSwapRequest(session.companyId, session, id, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
