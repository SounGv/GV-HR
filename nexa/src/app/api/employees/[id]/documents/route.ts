import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, created, handleApiError } from "@/lib/api/response";
import { employeeDocumentCreateSchema } from "@/features/employee-document/schema";
import { addEmployeeDocument, listEmployeeDocuments } from "@/features/employee-document/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:read");
    const { id } = await params;
    return ok(await listEmployeeDocuments(session.companyId, id, session));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("employee:update");
    const { id } = await params;
    const input = employeeDocumentCreateSchema.parse(await request.json());
    return created(await addEmployeeDocument(session.companyId, session, id, input, getRequestMeta(request)));
  } catch (err) {
    return handleApiError(err);
  }
}
