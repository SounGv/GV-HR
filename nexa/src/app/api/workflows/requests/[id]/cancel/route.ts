import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cancelRequest } from "@/features/workflow/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("workflow:read");
    const { id } = await params;
    const result = await cancelRequest(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
