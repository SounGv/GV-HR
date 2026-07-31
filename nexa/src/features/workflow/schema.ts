import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);

export const stepSchema = z.object({
  order: z.coerce.number().int().min(0),
  name: z.string().trim().min(1, "กรุณาระบุชื่อขั้น").max(80),
  approverRole: z.string().trim().min(1, "กรุณาเลือกผู้อนุมัติ").max(60),
});

export const workflowCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อเวิร์กโฟลว์").max(120),
  description: optionalText,
  steps: z.array(stepSchema).min(1, "ต้องมีอย่างน้อย 1 ขั้น").max(10),
  active: z.boolean().default(true),
});
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;

export const workflowUpdateSchema = workflowCreateSchema.partial();
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;

export const requestCreateSchema = z.object({
  workflowId: z.string().uuid("กรุณาเลือกเวิร์กโฟลว์"),
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อ").max(200),
  detail: optionalText,
  amount: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(100_000_000).optional(),
  ),
});
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;

export const requestDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: optionalText,
});
export type RequestDecideInput = z.infer<typeof requestDecideSchema>;

export const requestListQuerySchema = z.object({
  scope: z.enum(["me", "inbox", "all"]).default("me"),
});
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
