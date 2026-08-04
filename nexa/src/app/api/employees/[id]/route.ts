import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { employeeUpdateSchema } from "@/features/employee/schema";
import { getEmployee, updateEmployee, softDeleteEmployee } from "@/features/employee/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:read");
    const { id } = await params;
    const employee = await getEmployee(session.companyId, id, session);
    return ok(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = employeeUpdateSchema.parse(body);
    const employee = await updateEmployee(session.companyId, id, input, session, getRequestMeta(req));
    return ok(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:delete");
    const { id } = await params;
    await softDeleteEmployee(session.companyId, id, session, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
