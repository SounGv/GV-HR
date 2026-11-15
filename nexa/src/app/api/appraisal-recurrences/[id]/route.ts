import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { recurrenceSchema } from "@/features/appraisal-round/schema";
import { deleteRecurrence, updateRecurrence } from "@/features/appraisal-round/recurrence-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const body = recurrenceSchema.parse(await req.json());
    return ok(await updateRecurrence(session.companyId, session, id, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}

/** Stops the setup. Rounds it already made are kept. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    return ok(await deleteRecurrence(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
