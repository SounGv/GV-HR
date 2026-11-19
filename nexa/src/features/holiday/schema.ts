import { z } from "zod";
import { calendarDate } from "@/lib/date-schema";
import { updateSchemaOf } from "@/lib/zod-update";

export const HOLIDAY_TYPES = ["COMPANY", "NATIONAL"] as const;

export const holidayCreateSchema = z.object({
  date: calendarDate({ message: "กรุณาเลือกวันที่" }),
  name: z.string().trim().min(1, "กรุณากรอกชื่อวันหยุด").max(200),
  type: z.enum(HOLIDAY_TYPES).default("COMPANY"),
  notifyEnabled: z.coerce.boolean().default(true),
});
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

// Not .partial(): in Zod 4 that keeps the defaults and a PATCH of the name would reset type and notifications.
export const holidayUpdateSchema = updateSchemaOf(holidayCreateSchema);
export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>;

export const holidayListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type HolidayListQuery = z.infer<typeof holidayListQuerySchema>;
