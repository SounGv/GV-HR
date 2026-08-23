import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { saveDraftSchema } from "@/features/campaign/schema";
import { saveDraftResponse } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ participantId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { participantId } = await params;
    const body = await req.json().catch(() => ({}));
    const input = saveDraftSchema.parse(body);
    const result = await saveDraftResponse(session.companyId, session, participantId, input);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
