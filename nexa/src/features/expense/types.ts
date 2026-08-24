export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";
export type ExpenseCategory = "travel" | "food" | "supplies" | "accommodation" | "medical" | "other";
export type ExpenseScope = "me" | "team" | "all";

export interface ExpenseClaim {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string | null;
  receiptUrl: string | null;
  status: ExpenseStatus;
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

export interface ExpenseFormValues {
  title: string;
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  description?: string;
  receiptUrl?: string;
}
