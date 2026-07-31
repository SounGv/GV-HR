import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { candidateCreateSchema, candidateListQuerySchema } from "@/features/recruitment/schema";
import { createCandidate, listCandidates } from "@/features/recruitment/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("recruitment:read");
    const filter = candidateListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const candidates = await listCandidates(session.companyId, filter);
    return ok(candidates);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("recruitment:create");
    const input = candidateCreateSchema.parse(await req.json().catch(() => ({})));
    const candidate = await createCandidate(session.companyId, session, input, getRequestMeta(req));
    return created(candidate);
  } catch (err) {
    return handleApiError(err);
  }
}
