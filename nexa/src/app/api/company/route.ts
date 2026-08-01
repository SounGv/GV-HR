import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { companyProfileSchema } from "@/features/company/schema";
import { getCompanyProfile, updateCompanyProfile } from "@/features/company/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("admin:read");
    return ok(await getCompanyProfile(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("admin:update");
    const input = companyProfileSchema.parse(await request.json());
    const data = await updateCompanyProfile(
      session.companyId,
      input,
      session,
      getRequestMeta(request),
    );
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
