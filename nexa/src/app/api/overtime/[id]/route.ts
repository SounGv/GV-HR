import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { BadRequest } from "@/lib/api/errors";
import { otUpdateReasonSchema, otUpdateNoteSchema } from "@/features/overtime/schema";
import { updateOvertimeReason, updateOvertimeNote } from "@/features/overtime/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

// Edits a request already created via POST /api/overtime — the requester's
// own `reason` or the deciding manager/HR's `decisionNote`, whichever the
// body carries. Each field has its own authorization rule enforced in the
// service layer (own/managesTarget/HR for reason; managesTarget/HR + a
// decision already made for note), so this route just dispatches on which
// key is present rather than gating by a single permission up front — one
// call edits exactly one field, never both, so a stale client sending both
// at once gets a real error instead of one silently overwriting the other.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const meta = getRequestMeta(req);

    const hasReason = Object.prototype.hasOwnProperty.call(body, "reason");
    const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
    if (hasReason && hasNote) {
      throw BadRequest("แก้ไขได้ทีละอย่าง — ส่งมาแค่ reason หรือ note ไม่ใช่ทั้งคู่พร้อมกัน");
    }

    if (hasReason) {
      const input = otUpdateReasonSchema.parse(body);
      return ok(await updateOvertimeReason(session.companyId, session, id, input, meta));
    }
    if (hasNote) {
      const input = otUpdateNoteSchema.parse(body);
      return ok(await updateOvertimeNote(session.companyId, session, id, input, meta));
    }
    throw BadRequest("ต้องระบุ reason หรือ note อย่างใดอย่างหนึ่ง");
  } catch (err) {
    return handleApiError(err);
  }
}
