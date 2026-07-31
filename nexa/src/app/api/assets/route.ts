import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { assetCreateSchema, assetListQuerySchema } from "@/features/asset/schema";
import { createAsset, listAssets } from "@/features/asset/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("asset:read");
    const query = assetListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const assets = await listAssets(session.companyId, query);
    return ok(assets);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("asset:create");
    const input = assetCreateSchema.parse(await req.json().catch(() => ({})));
    const asset = await createAsset(session.companyId, session, input, getRequestMeta(req));
    return created(asset);
  } catch (err) {
    return handleApiError(err);
  }
}
