import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { departmentUpdateSchema } from "@/features/organization/schema";
import { getDepartment, updateDepartment, deleteDepartment } from "@/features/organization/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("employee:read");
    const { id } = await params;
    return ok(await getDepartment(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("employee:update");
    const { id } = await params;
    const input = departmentUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateDepartment(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("employee:delete");
    const { id } = await params;
    const result = await deleteDepartment(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
