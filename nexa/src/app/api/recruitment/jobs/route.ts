import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { jobCreateSchema, jobListQuerySchema } from "@/features/recruitment/schema";
import { createJob, listJobs } from "@/features/recruitment/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("recruitment:read");
    const { status } = jobListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const jobs = await listJobs(session.companyId, status);
    return ok(jobs);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("recruitment:create");
    const input = jobCreateSchema.parse(await req.json().catch(() => ({})));
    const result = await createJob(session.companyId, session, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
