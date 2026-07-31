import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { otDecideSchema } from "@/features/overtime/schema";
import { decideOvertime } from "@/features/overtime/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("overtime:approve");
    const { id } = await params;
    const input = otDecideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideOvertime(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
