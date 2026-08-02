import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { announcementUpdateSchema } from "@/features/announcement/schema";
import { getAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/features/announcement/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("announcement:read");
    const { id } = await params;
    return ok(await getAnnouncement(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("announcement:update");
    const { id } = await params;
    const input = announcementUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateAnnouncement(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("announcement:delete");
    const { id } = await params;
    await deleteAnnouncement(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
