export type LoanStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type LoanScope = "me" | "team" | "all";

export interface CompanyLoanRequest {
  id: string;
  year: number;
  amount: number;
  salarySnapshot: number;
  installmentCount: number;
  reason: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  attachmentUrl: string | null;
  repaidAmount: number;
  status: LoanStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  paidAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface LoanFormValues {
  amount: string;
  installmentCount: string;
  reason?: string;
  bankName?: string;
  bankAccountNo?: string;
  attachmentUrl?: string;
}

export interface LoanEligibility {
  eligible: boolean;
  passedProbation: boolean;
  completedOneYear: boolean;
  currentSalary: number | null;
  maxLoanAmount: number;
  usedThisYear: boolean;
}
