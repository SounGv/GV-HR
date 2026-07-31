import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { courseCreateSchema } from "@/features/training/schema";
import { listCourses, createCourse } from "@/features/training/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("training:read");
    const records = await listCourses(session.companyId, session);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("training:create");
    const input = courseCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createCourse(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
