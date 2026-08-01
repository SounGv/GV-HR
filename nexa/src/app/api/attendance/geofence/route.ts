import type { NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { geofenceSchema } from "@/features/geofence/schema";
import { listGeofences, updateGeofence } from "@/features/geofence/service";

export const runtime = "nodejs";

const MANAGE = ["admin:update", "attendance:update"];

export async function GET() {
  try {
    const session = await requireAnyPermission(MANAGE);
    return ok(await listGeofences(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAnyPermission(MANAGE);
    const input = geofenceSchema.parse(await request.json());
    return ok(await updateGeofence(session.companyId, input, session, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
