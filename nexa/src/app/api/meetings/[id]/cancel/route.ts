import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cancelMeeting } from "@/features/meeting/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("meeting:delete");
    const { id } = await params;
    const record = await cancelMeeting(session.companyId, session, id, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
