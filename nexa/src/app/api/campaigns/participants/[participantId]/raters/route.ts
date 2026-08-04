import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { inviteRaterSchema } from "@/features/campaign/schema";
import { invitePeerRater } from "@/features/campaign/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ participantId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { participantId } = await params;
    const input = inviteRaterSchema.parse(await req.json().catch(() => ({})));
    const result = await invitePeerRater(session.companyId, session, participantId, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
