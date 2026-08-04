import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { swapRequestDecideSchema } from "@/features/shift/schema";
import { decideSwapRequest } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("shift:read");
    const { id } = await params;
    const input = swapRequestDecideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideSwapRequest(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
