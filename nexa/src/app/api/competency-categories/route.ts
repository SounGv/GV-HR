import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { competencyCategoryCreateSchema } from "@/features/competency-category/schema";
import { listCompetencyCategories, createCompetencyCategory } from "@/features/competency-category/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:read");
    const categories = await listCompetencyCategories(session.companyId);
    return ok(categories);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const body = await req.json().catch(() => ({}));
    const input = competencyCategoryCreateSchema.parse(body);
    const category = await createCompetencyCategory(session.companyId, session, input, getRequestMeta(req));
    return created(category);
  } catch (err) {
    return handleApiError(err);
  }
}
