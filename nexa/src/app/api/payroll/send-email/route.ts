import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { sendPayslipEmailSchema } from "@/features/payroll/schema";
import { sendPayslipEmails } from "@/features/payroll/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";
import { appBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("payroll:export");
    const { payrollRecordIds } = sendPayslipEmailSchema.parse(await req.json().catch(() => ({})));

    // The app's own address, not the request's Host header: a request that arrives through a preview or proxy host
    // would otherwise put that host into every payslip email.
    const verifyBaseUrl = appBaseUrl();

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
