import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { sendPayslipEmailSchema } from "@/features/payroll/schema";
import { sendPayslipEmails } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("payroll:export");
    const { payrollRecordIds } = sendPayslipEmailSchema.parse(await req.json().catch(() => ({})));

    const host = req.headers.get("host") ?? "gv-hr.vercel.app";
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const verifyBaseUrl = `${proto}://${host}`;

    const result = await sendPayslipEmails(
      session.companyId,
      session,
      payrollRecordIds,
      verifyBaseUrl,
      getRequestMeta(req),
    );
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
