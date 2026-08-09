import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { payrollImportPayloadSchema } from "@/features/payroll-import/schema";
import { importPayrollAdjustments } from "@/features/payroll-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("payroll:update");
    const { rows } = payrollImportPayloadSchema.parse(await request.json().catch(() => ({})));
    const summary = await importPayrollAdjustments(
      session.companyId,
      session,
      rows as Record<string, unknown>[],
      getRequestMeta(request),
    );
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
