import { z } from "zod";

export const clockSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracy: z.number().finite().optional(),
});
export type ClockInput = z.infer<typeof clockSchema>;

export const attendanceListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
