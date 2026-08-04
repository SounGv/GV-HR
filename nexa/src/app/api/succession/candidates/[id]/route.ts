import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { candidateUpdateSchema } from "@/features/succession/schema";
import { removeCandidate, updateCandidate } from "@/features/succession/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:update");
    const { id } = await params;
    const input = candidateUpdateSchema.parse(await req.json().catch(() => ({})));
    const result = await updateCandidate(session.companyId, session, id, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:update");
    const { id } = await params;
    await removeCandidate(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
