import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { requestReopenSchema } from "@/features/campaign/schema";
import { requestReopen } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = requestReopenSchema.parse(body);
    const result = await requestReopen(session.companyId, session, id, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
