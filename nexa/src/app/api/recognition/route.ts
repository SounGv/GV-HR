import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { recognitionCreateSchema, recognitionListQuerySchema } from "@/features/recognition/schema";
import { createRecognition, listRecognition } from "@/features/recognition/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("recognition:read");
    const query = recognitionListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const rows = await listRecognition(session.companyId, session, query);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("recognition:create");
    const body = await req.json().catch(() => ({}));
    const input = recognitionCreateSchema.parse(body);
    const record = await createRecognition(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
