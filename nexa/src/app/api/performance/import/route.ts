import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { performanceImportPayloadSchema } from "@/features/performance-import/schema";
import { importPerformanceReviews } from "@/features/performance-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("performance:approve");
    const { rows } = performanceImportPayloadSchema.parse(await request.json().catch(() => ({})));
    const summary = await importPerformanceReviews(
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
