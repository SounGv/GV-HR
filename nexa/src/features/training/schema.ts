import { z } from "zod";

export const TRAINING_STATUSES = ["OPEN", "CLOSED"] as const;
export const ENROLLMENT_STATUSES = ["ENROLLED", "COMPLETED", "CANCELLED"] as const;

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);

export const courseCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อหลักสูตร").max(200),
  description: optionalText,
  category: z.string().trim().min(1).max(60).default("ทั่วไป"),
  provider: optionalText,
  hours: z.coerce.number().min(0).max(1000).default(0),
  location: optionalText,
  scheduledDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional(),
  ),
  capacity: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  status: z.enum(TRAINING_STATUSES).default("OPEN"),
});
export type CourseCreateInput = z.infer<typeof courseCreateSchema>;

export const courseUpdateSchema = courseCreateSchema.partial();
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

export const enrollmentUpdateSchema = z.object({
  status: z.enum(ENROLLMENT_STATUSES),
  score: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(100).optional(),
  ),
});
export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>;
