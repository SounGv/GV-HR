import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { markAllRead, markOneRead } from "@/features/notification/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.employeeId) {
      // { id } → just that one (tapping a notification to follow its link);
      // no body / no id → the existing "mark all" bulk action.
      const body = await request.json().catch(() => ({}) as { id?: unknown });
      const id = typeof body.id === "string" ? body.id : undefined;
      if (id) {
        await markOneRead(session.companyId, session.employeeId, id);
      } else {
        await markAllRead(session.companyId, session.employeeId);
      }
    }
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
