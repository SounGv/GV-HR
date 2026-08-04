import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { submitResponseSchema } from "@/features/campaign/schema";
import { submitMyResponse } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ participantId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { participantId } = await params;
    const body = await req.json().catch(() => ({}));
    const input = submitResponseSchema.parse(body);
    const result = await submitMyResponse(session.companyId, session, participantId, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
