import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { costCenterUpdateSchema } from "@/features/cost-center/schema";
import { updateCostCenter, deleteCostCenter } from "@/features/cost-center/service";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    const input = costCenterUpdateSchema.parse(await request.json());
    return ok(await updateCostCenter(session.companyId, id, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    return ok(await deleteCostCenter(session.companyId, id, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
