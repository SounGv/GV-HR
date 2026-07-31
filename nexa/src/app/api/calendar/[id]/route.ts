import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { eventUpdateSchema } from "@/features/calendar/schema";
import { updateEvent, deleteEvent } from "@/features/calendar/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("calendar:update");
    const { id } = await params;
    const input = eventUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateEvent(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("calendar:delete");
    const { id } = await params;
    const result = await deleteEvent(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
