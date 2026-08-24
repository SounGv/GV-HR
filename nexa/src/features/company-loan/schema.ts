import { z } from "zod";

export const LOAN_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED"] as const;

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(500).optional(),
);

export const loanCreateSchema = z.object({
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  installmentCount: z.coerce.number().int().min(1, "จำนวนงวดต้องมากกว่า 0").max(36),
  reason: optionalText,
  bankName: optionalText,
  bankAccountNo: optionalText,
  attachmentUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
});
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;

export const loanDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: optionalText,
});
export type LoanDecideInput = z.infer<typeof loanDecideSchema>;

export const loanRepaySchema = z.object({
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
});
export type LoanRepayInput = z.infer<typeof loanRepaySchema>;

export const loanListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(LOAN_STATUSES).optional(),
});
export type LoanListQuery = z.infer<typeof loanListQuerySchema>;
