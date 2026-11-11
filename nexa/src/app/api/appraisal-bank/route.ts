import { requirePermission } from "@/lib/auth/guard";
import { listBank } from "@/features/appraisal-form/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** The question bank (คลังหัวข้อ) for the form builder's picker. */
export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await listBank(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}
