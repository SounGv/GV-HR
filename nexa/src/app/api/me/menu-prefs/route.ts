import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { getMenuPrefs, resetMenuPrefs, saveMenuPrefs } from "@/features/menu-prefs/service";
import { EMPTY_MENU_PREFS } from "@/features/menu-prefs/rules";

export const runtime = "nodejs";

/** The signed-in person's own sidebar layout. Every method works only on their own account. */
export async function GET() {
  try {
    const session = await requireSession();
    return ok(await getMenuPrefs(session.sub));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => null);
    return ok(await saveMenuPrefs(session.sub, body));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    await resetMenuPrefs(session.sub);
    return ok({ ...EMPTY_MENU_PREFS, itemOrder: {} });
  } catch (err) {
    return handleApiError(err);
  }
}
