import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { addParticipantsSchema } from "@/features/campaign/schema";
import { addParticipants } from "@/features/campaign/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = addParticipantsSchema.parse(body);
    const result = await addParticipants(session.companyId, session, id, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
