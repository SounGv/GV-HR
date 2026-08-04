import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { candidateCreateSchema } from "@/features/succession/schema";
import { addCandidate } from "@/features/succession/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:update");
    const { id } = await params;
    const input = candidateCreateSchema.parse(await req.json().catch(() => ({})));
    const result = await addCandidate(session.companyId, session, id, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
