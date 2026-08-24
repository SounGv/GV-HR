import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { campaignCreateSchema, campaignListQuerySchema } from "@/features/campaign/schema";
import { listCampaigns, createCampaign } from "@/features/campaign/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:manage");
    const query = campaignListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const campaigns = await listCampaigns(session.companyId, query);
    return ok(campaigns);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const body = await req.json().catch(() => ({}));
    const input = campaignCreateSchema.parse(body);
    const campaign = await createCampaign(session.companyId, session, input, getRequestMeta(req));
    return created(campaign);
  } catch (err) {
    return handleApiError(err);
  }
}
