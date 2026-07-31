import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { listNotifications, unreadCount } from "@/features/notification/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.employeeId) {
      return ok({ items: [], unread: 0 });
    }
    const [items, unread] = await Promise.all([
      listNotifications(session.companyId, session.employeeId),
      unreadCount(session.companyId, session.employeeId),
    ]);
    return ok({ items, unread });
  } catch (error) {
    return handleApiError(error);
  }
}
