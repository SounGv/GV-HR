import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { NotFound } from "@/lib/api/errors";
import { handleApiError } from "@/lib/api/response";
import { teamScopeFilter } from "@/features/employee/service";

export const runtime = "nodejs";

const querySchema = z.object({ kind: z.enum(["in", "out"]), v: z.string().optional() });
const paramsSchema = z.object({ id: z.string().uuid() });

// Stored as `data:image/<type>;base64,<data>` (see lib/image-schema.ts). Only
// raster types are served; anything else is treated as "no photo".
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([\s\S]+)$/;
const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * One check-in / check-out photo as a real image, so the daily report can list
 * thousands of rows without carrying the photos inside its JSON and the
 * browser loads only the thumbnails that scroll into view.
 *
 * Same access rule as the report that lists it: `report:read`, and anyone who
 * is not company-wide sees only their own and their direct reports' records
 * (`teamScopeFilter`). Read-only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("report:read");
    const { id } = paramsSchema.parse(await params);
    const { kind } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));

    const scope = teamScopeFilter(session);
    const record = await prisma.attendanceRecord.findFirst({
      where: { id, companyId: session.companyId, deletedAt: null, ...(scope ? { employee: scope } : {}) },
      // Only the requested photo is read; the other column is not selected.
      select: { clockInPhotoUrl: kind === "in", clockOutPhotoUrl: kind === "out" },
    });
    const dataUrl = kind === "in" ? record?.clockInPhotoUrl : record?.clockOutPhotoUrl;
    const match = dataUrl ? DATA_URL_RE.exec(dataUrl) : null;
    if (!match) throw NotFound("ไม่พบรูปถ่าย");

    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": CONTENT_TYPE[match[1]],
        // `v` in the URL changes whenever the record changes, so a long cache is safe;
        // `private` keeps a shared proxy from storing a person's photo.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
