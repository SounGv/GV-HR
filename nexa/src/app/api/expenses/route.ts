import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { expenseCreateSchema, expenseListQuerySchema } from "@/features/expense/schema";
import { createExpense, listExpenses } from "@/features/expense/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("expense:read");
    const query = expenseListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !can(session.perms, "expense:approve")) {
      throw Forbidden("ไม่มีสิทธิ์ดูรายการของผู้อื่น");
    }
    const records = await listExpenses(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("expense:create");
    const input = expenseCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createExpense(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
