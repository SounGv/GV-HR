import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { reportQuerySchema } from "@/features/report/schema";
import { getReport } from "@/features/report/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("report:read");
    const { type, period } = reportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const result = await getReport(session.companyId, type, period);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
