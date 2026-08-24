import { requirePermission } from "@/lib/auth/guard";
import { listLeave } from "@/features/leave/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/**
 * The employee's own approved sick-leave requests, for the "อ้างอิงใบลาป่วย"
 * picker on the medical expense claim form. Read-only reuse of the leave
 * module's own `listLeave` — no leave file is modified for this.
 */
export async function GET() {
  try {
    const session = await requirePermission("expense:create");
    const rows = await listLeave(session.companyId, session, { scope: "me" });
    const sickLeaves = rows
      .filter((r) => r.type === "SICK" && r.status === "APPROVED")
      .map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        days: r.days,
        attachmentUrl: r.attachmentUrl,
      }));
    return ok(sickLeaves);
  } catch (err) {
    return handleApiError(err);
  }
}
