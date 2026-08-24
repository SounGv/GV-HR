import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { competencyCreateSchema, competencyListQuerySchema } from "@/features/competency/schema";
import { listCompetencies, createCompetency } from "@/features/competency/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:manage");
    const query = competencyListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const competencies = await listCompetencies(session.companyId, query);
    return ok(competencies);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const body = await req.json().catch(() => ({}));
    const input = competencyCreateSchema.parse(body);
    const competency = await createCompetency(session.companyId, session, input, getRequestMeta(req));
    return created(competency);
  } catch (err) {
    return handleApiError(err);
  }
}
