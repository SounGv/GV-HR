import type { NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { employeeAccountSchema } from "@/features/employee/schema";
import { createEmployeeAccount } from "@/features/employee/account";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission(["admin:update", "employee:update"]);
    const { id } = await params;
    const input = employeeAccountSchema.parse(await request.json());
    return ok(await createEmployeeAccount(session.companyId, id, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
