import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { markAllRead } from "@/features/notification/service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    if (session.employeeId) {
      await markAllRead(session.companyId, session.employeeId);
    }
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
