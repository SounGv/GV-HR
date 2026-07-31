import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { courseUpdateSchema } from "@/features/training/schema";
import { updateCourse, deleteCourse } from "@/features/training/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("training:update");
    const { id } = await params;
    const input = courseUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateCourse(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("training:delete");
    const { id } = await params;
    const result = await deleteCourse(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
