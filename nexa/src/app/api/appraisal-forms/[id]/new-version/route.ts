import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { createNewVersion } from "@/features/appraisal-form/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:create");
    const { id } = await params;
    return created(await createNewVersion(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
