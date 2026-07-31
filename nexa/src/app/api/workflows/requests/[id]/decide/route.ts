import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { requestDecideSchema } from "@/features/workflow/schema";
import { decideRequest } from "@/features/workflow/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("workflow:read");
    const { id } = await params;
    const input = requestDecideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideRequest(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
