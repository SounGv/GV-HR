import type { NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { employeeAccountSchema, employeeAccountUpdateSchema } from "@/features/employee/schema";
import { createEmployeeAccount, updateEmployeeAccount } from "@/features/employee/account";

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission(["admin:update", "employee:update"]);
    const { id } = await params;
    // Login ID (email / username) and/or password; a body with only {password} still works as a reset.
    const input = employeeAccountUpdateSchema.parse(await request.json());
    return ok(await updateEmployeeAccount(session.companyId, id, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
