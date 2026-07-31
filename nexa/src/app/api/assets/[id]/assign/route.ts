import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { assignSchema } from "@/features/asset/schema";
import { assignAsset } from "@/features/asset/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("asset:update");
    const { id } = await params;
    const { employeeId } = assignSchema.parse(await req.json().catch(() => ({})));
    const asset = await assignAsset(session.companyId, session, id, employeeId, getRequestMeta(req));
    return ok(asset);
  } catch (err) {
    return handleApiError(err);
  }
}
