import { requirePermission } from "@/lib/auth/guard";
import { listUsers } from "@/features/admin/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("admin:read");
    const users = await listUsers(session.companyId);
    return ok(users);
  } catch (err) {
    return handleApiError(err);
  }
}
