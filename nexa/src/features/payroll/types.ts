export type PayrollStatus = "DRAFT" | "PAID";
export type PayrollScope = "me" | "all";

export interface PayrollLineItem {
  label: string;
  amount: number;
}

export interface PayrollRecord {
  id: string;
  period: string;
  periodLabel: string;
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  gross: number;
  totalDeductions: number;
  net: number;
  status: PayrollStatus;
  paidAt: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    email: string | null;
    departmentId: string | null;
  };
}

export interface GenerateResult {
  period: string;
  periodLabel: string;
  count: number;
}
