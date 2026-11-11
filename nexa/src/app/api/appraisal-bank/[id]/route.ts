import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { removeFromBank } from "@/features/appraisal-form/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Takes a question out of the bank; forms that already use it keep their own copy. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    return ok(await removeFromBank(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
