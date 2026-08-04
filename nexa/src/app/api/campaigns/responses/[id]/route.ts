import { requirePermission } from "@/lib/auth/guard";
import { removeRater } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    const result = await removeRater(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
