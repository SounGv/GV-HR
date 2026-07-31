import { type NextRequest } from "next/server";
import { requirePermission, requireSession } from "@/lib/auth/guard";
import { enrollmentUpdateSchema } from "@/features/training/schema";
import { updateEnrollment, cancelEnrollment } from "@/features/training/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("training:update");
    const { id } = await params;
    const input = enrollmentUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateEnrollment(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const result = await cancelEnrollment(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
