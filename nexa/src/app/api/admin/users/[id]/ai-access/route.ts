import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { setAiAccessGrantSchema } from "@/features/admin/schema";
import { setAiAccessGrant, revokeAiAccessGrant } from "@/features/admin/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    const { scope } = setAiAccessGrantSchema.parse(await req.json().catch(() => ({})));
    await setAiAccessGrant(session.companyId, session, id, scope, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    await revokeAiAccessGrant(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
