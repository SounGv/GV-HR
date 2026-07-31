import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { assetUpdateSchema } from "@/features/asset/schema";
import { deleteAsset, updateAsset } from "@/features/asset/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("asset:update");
    const { id } = await params;
    const input = assetUpdateSchema.parse(await req.json().catch(() => ({})));
    const asset = await updateAsset(session.companyId, session, id, input, getRequestMeta(req));
    return ok(asset);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("asset:delete");
    const { id } = await params;
    await deleteAsset(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
