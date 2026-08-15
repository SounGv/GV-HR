import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { removeEmployeeDocument } from "@/features/employee-document/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:update");
    const { id, docId } = await params;
    return ok(await removeEmployeeDocument(session.companyId, session, id, docId, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
