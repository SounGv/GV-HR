import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { branchUpdateSchema } from "@/features/branch/schema";
import { updateBranch, deleteBranch } from "@/features/branch/service";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    const input = branchUpdateSchema.parse(await request.json());
    return ok(await updateBranch(session.companyId, id, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    return ok(await deleteBranch(session.companyId, id, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
