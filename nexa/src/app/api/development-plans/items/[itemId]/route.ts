import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { developmentItemUpdateSchema } from "@/features/development-plan/schema";
import { deleteItem, updateItem } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const session = await requirePermission("performance:read");
    const { itemId } = await params;
    const input = developmentItemUpdateSchema.parse(await req.json().catch(() => ({})));
    const plan = await updateItem(session, itemId, input);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const session = await requirePermission("performance:read");
    const { itemId } = await params;
    const plan = await deleteItem(session, itemId);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}
