import QRCode from "qrcode";
import { requireSession } from "@/lib/auth/guard";
import { setupTwoFactor } from "@/lib/auth/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    const { secret, otpauthUrl } = await setupTwoFactor(session.sub);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
    return ok({ secret, otpauthUrl, qrDataUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
