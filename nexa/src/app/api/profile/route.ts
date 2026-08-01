import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { selfProfileSchema } from "@/features/profile/schema";
import { getMyProfile, updateMyProfile } from "@/features/profile/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return ok(await getMyProfile(session));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const input = selfProfileSchema.parse(await request.json());
    return ok(await updateMyProfile(session, input, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
