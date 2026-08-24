import { z } from "zod";
import { dataUrlOrHttpUrlSchema } from "@/lib/image-schema";

export const EXPENSE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED"] as const;
export const EXPENSE_CATEGORIES = [
  "travel",
  "food",
  "supplies",
  "accommodation",
  "medical",
  "other",
] as const;

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);
const optionalId = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().uuid().optional());

export const expenseCreateSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณาระบุรายการ").max(200),
    category: z.enum(EXPENSE_CATEGORIES).default("other"),
    amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0").max(10_000_000),
    expenseDate: z.coerce.date({ message: "กรุณาเลือกวันที่" }),
    description: optionalText,
    receiptUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), dataUrlOrHttpUrlSchema()),
    // Medical-only fields (category === "medical") — see feature spec.
    hospitalName: optionalText,
    sickLeaveRequestId: optionalId,
    // "DRAFT" saves incomplete/over-cap input without validation; omit (or
    // "PENDING") to submit for approval immediately, running full validation.
    status: z.enum(["DRAFT", "PENDING"]).default("PENDING"),
  })
  .refine(
    (d) => d.category !== "medical" || d.status === "DRAFT" || !!d.hospitalName,
    { message: "กรุณาระบุโรงพยาบาล/คลินิก", path: ["hospitalName"] },
  );
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const expenseDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: optionalText,
});
export type ExpenseDecideInput = z.infer<typeof expenseDecideSchema>;

export const expenseListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(EXPENSE_STATUSES).optional(),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
