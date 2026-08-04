import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { campaignUpdateSchema } from "@/features/campaign/schema";
import { getCampaign, updateCampaign, deleteCampaign } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    return ok(await getCampaign(session.companyId, id, session));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = campaignUpdateSchema.parse(body);
    const campaign = await updateCampaign(session.companyId, session, id, input, getRequestMeta(req));
    return ok(campaign);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:delete");
    const { id } = await params;
    await deleteCampaign(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
