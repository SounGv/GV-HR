import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, created, handleApiError } from "@/lib/api/response";
import { branchCreateSchema } from "@/features/branch/schema";
import { listBranches, createBranch } from "@/features/branch/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("admin:read");
    return ok(await listBranches(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("admin:update");
    const input = branchCreateSchema.parse(await request.json());
    return created(await createBranch(session.companyId, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
