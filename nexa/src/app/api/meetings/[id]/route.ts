import { requirePermission } from "@/lib/auth/guard";
import { getMeeting } from "@/features/meeting/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("meeting:read");
    const { id } = await params;
    const record = await getMeeting(session.companyId, session, id);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
