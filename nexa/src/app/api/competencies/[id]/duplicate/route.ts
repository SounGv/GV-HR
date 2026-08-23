import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { duplicateCompetency } from "@/features/competency/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:create");
    const { id } = await params;
    const copy = await duplicateCompetency(session.companyId, session, id, getRequestMeta(req));
    return created(copy);
  } catch (err) {
    return handleApiError(err);
  }
}
