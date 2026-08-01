import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { importPayloadSchema } from "@/features/employee-import/schema";
import { importEmployees } from "@/features/employee-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("employee:create");
    const { rows } = importPayloadSchema.parse(await request.json());
    const summary = await importEmployees(
      session.companyId,
      rows as Record<string, unknown>[],
      session,
      getRequestMeta(request),
    );
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
