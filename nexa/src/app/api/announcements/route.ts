import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { announcementCreateSchema, announcementListQuerySchema } from "@/features/announcement/schema";
import { createAnnouncement, listAnnouncements } from "@/features/announcement/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("announcement:read");
    const query = announcementListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope === "manage" && !can(session.perms, "announcement:create")) {
      throw Forbidden("ไม่มีสิทธิ์จัดการประกาศ");
    }
    const records = await listAnnouncements(session.companyId, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("announcement:create");
    const input = announcementCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createAnnouncement(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
