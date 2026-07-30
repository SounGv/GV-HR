import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { holidayUpdateSchema } from "@/features/holiday/schema";
import { updateHoliday, deleteHoliday } from "@/features/holiday/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("holiday:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = holidayUpdateSchema.parse(body);
    const holiday = await updateHoliday(session.companyId, id, input, session, getRequestMeta(req));
    return ok(holiday);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("holiday:delete");
    const { id } = await params;
    await deleteHoliday(session.companyId, id, session, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
