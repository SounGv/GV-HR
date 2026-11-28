import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { kpiImportPayloadSchema } from "@/features/kpi-import/schema";
import { importKpiGoals } from "@/features/kpi-import/service";

export const runtime = "nodejs";
// A large file is saved one row at a time on a one-connection pool, so allow it the time it needs.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("kpi:create");
    const { rows } = kpiImportPayloadSchema.parse(await request.json().catch(() => ({})));
    const summary = await importKpiGoals(
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
