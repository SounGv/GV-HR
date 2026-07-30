import { z } from "zod";

export const HOLIDAY_TYPES = ["COMPANY", "NATIONAL"] as const;

export const holidayCreateSchema = z.object({
  date: z.coerce.date({ message: "กรุณาเลือกวันที่" }),
  name: z.string().trim().min(1, "กรุณากรอกชื่อวันหยุด").max(200),
  type: z.enum(HOLIDAY_TYPES).default("COMPANY"),
  notifyEnabled: z.coerce.boolean().default(true),
});
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

export const holidayUpdateSchema = holidayCreateSchema.partial();
export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>;

export const holidayListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type HolidayListQuery = z.infer<typeof holidayListQuerySchema>;
