import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cloneTemplate } from "@/features/evaluation-template/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:create");
    const { id } = await params;
    const cloned = await cloneTemplate(session.companyId, session, id, getRequestMeta(req));
    return ok(cloned);
  } catch (err) {
    return handleApiError(err);
  }
}
