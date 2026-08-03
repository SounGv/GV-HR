import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { candidateUpdateSchema } from "@/features/recruitment/schema";
import { deleteCandidate, getCandidate, updateCandidate } from "@/features/recruitment/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("recruitment:read");
    const { id } = await params;
    return ok(await getCandidate(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("recruitment:update");
    const { id } = await params;
    const input = candidateUpdateSchema.parse(await req.json().catch(() => ({})));
    const candidate = await updateCandidate(session.companyId, session, id, input, getRequestMeta(req));
    return ok(candidate);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("recruitment:delete");
    const { id } = await params;
    await deleteCandidate(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
