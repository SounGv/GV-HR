import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { employeeListQuerySchema, employeeCreateSchema } from "@/features/employee/schema";
import { listEmployees, createEmployee } from "@/features/employee/service";
import { okPaginated, created, handleApiError } from "@/lib/api/response";
import { buildPageMeta } from "@/lib/api/pagination";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("employee:read");
    const query = employeeListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const { items, total } = await listEmployees(session.companyId, query, session);
    return okPaginated(items, buildPageMeta(query, total));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("employee:create");
    const body = await req.json().catch(() => ({}));
    const input = employeeCreateSchema.parse(body);
    const employee = await createEmployee(session.companyId, input, session, getRequestMeta(req));
    return created(employee);
  } catch (err) {
    return handleApiError(err);
  }
}
