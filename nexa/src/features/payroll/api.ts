import { api, type Envelope } from "@/lib/api/client";
import type { GenerateResult, PayrollRecord, PayrollScope } from "./types";

export function fetchPayroll(scope: PayrollScope, period?: string) {
  const params = new URLSearchParams({ scope });
  if (period) params.set("period", period);
  return api.get<Envelope<PayrollRecord[]>>(`/api/payroll?${params.toString()}`);
}

export function fetchPayslip(id: string) {
  return api.get<Envelope<PayrollRecord>>(`/api/payroll/${id}`);
}

export function generatePayroll(period: string) {
  return api.post<Envelope<GenerateResult>>("/api/payroll", { period });
}

export function payPayroll(id: string) {
  return api.post<Envelope<PayrollRecord>>(`/api/payroll/${id}/pay`);
}

export function sendPayslipEmails(payrollRecordIds: string[]) {
  return api.post<Envelope<{ sent: string[]; skipped: { employeeId: string; name: string; reason: string }[] }>>(
    "/api/payroll/send-email",
    { payrollRecordIds },
  );
}
