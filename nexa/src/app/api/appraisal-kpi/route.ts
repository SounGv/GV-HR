import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { listProfiles, saveProfile } from "@/features/appraisal-kpi/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

const body = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, "กรุณาระบุชื่อโปรไฟล์").max(200),
  indicators: z
    .array(
      z.object({
        metric: z.string().min(1).max(40),
        weight: z.number().int().min(0).max(100),
        steps: z.array(z.object({ limit: z.number(), points: z.number().min(0).max(100) })).max(12),
      }),
    )
    .max(12),
  bands: z.array(z.object({ label: z.string().trim().max(60), min: z.number().min(0).max(100), tone: z.enum(["green", "yellow", "red", "black"]) })).max(8),
});

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await listProfiles(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const input = body.parse(await req.json().catch(() => ({})));
    return ok(await saveProfile(session.companyId, session, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
