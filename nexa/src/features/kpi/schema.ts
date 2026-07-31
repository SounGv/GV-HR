import { z } from "zod";

export const GOAL_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AT_RISK",
  "COMPLETED",
  "CANCELLED",
] as const;
export const GOAL_TYPES = ["KPI", "OKR"] as const;

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);

export const goalCreateSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  title: z.string().trim().min(1, "กรุณาระบุชื่อเป้าหมาย").max(200),
  description: optionalText,
  type: z.enum(GOAL_TYPES).default("KPI"),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบ").max(40),
  unit: z.string().trim().min(1).max(20).default("%"),
  targetValue: z.coerce.number().positive("เป้าหมายต้องมากกว่า 0"),
  currentValue: z.coerce.number().min(0).default(0),
  weight: z.coerce.number().int().min(1).max(5).default(1),
  status: z.enum(GOAL_STATUSES).default("NOT_STARTED"),
  dueDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional(),
  ),
});
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;

/** Full edit (managers) — all fields optional. */
export const goalUpdateSchema = goalCreateSchema.partial().omit({ employeeId: true });
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;

/** Progress-only update (goal owner). */
export const goalProgressSchema = z.object({
  currentValue: z.coerce.number().min(0),
  status: z.enum(GOAL_STATUSES).optional(),
});
export type GoalProgressInput = z.infer<typeof goalProgressSchema>;

export const goalListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  cycle: z.string().trim().max(40).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
});
export type GoalListQuery = z.infer<typeof goalListQuerySchema>;
