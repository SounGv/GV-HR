import { z } from "zod";
import { calendarDate } from "@/lib/date-schema";

export const EVENT_TYPES = ["event", "meeting", "deadline"] as const;

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณาระบุชื่อกิจกรรม").max(200),
    description: optionalText,
    type: z.enum(EVENT_TYPES).default("event"),
    startDate: calendarDate({ message: "กรุณาเลือกวันที่เริ่ม" }),
    endDate: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      calendarDate().optional(),
    ),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  });
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText,
  type: z.enum(EVENT_TYPES).optional(),
  startDate: calendarDate().optional(),
  endDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    calendarDate().nullable().optional(),
  ),
});
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)")
    .optional(),
});
