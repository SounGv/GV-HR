import { z } from "zod";

export const ATTENDANCE_WORK_MODES = ["ONSITE", "WFH"] as const;
export const ATTENDANCE_MOODS = ["TERRIBLE", "BAD", "OK", "GOOD", "EXCELLENT"] as const;

export const clockSchema = z.object({
  // Location is best-effort: the client sends it when GPS is granted. The server
  // only *requires* it when the employee's branch has a geofence configured.
  lat: z.number().finite().nullish(),
  lng: z.number().finite().nullish(),
  accuracy: z.number().finite().nullish(),
  // Selfie proof (data URL, ~<=3MB) + device UA string — both optional.
  photo: z.string().max(3_000_000).nullish(),
  device: z.string().max(400).nullish(),
  // When the employee is outside the branch geofence, they may still clock in by
  // explaining why (working off-site). Required only in that case (enforced server-side).
  offsiteReason: z.string().trim().max(500).nullish(),
  // Declared at clock-in: WFH skips the geofence requirement entirely.
  workMode: z.enum(ATTENDANCE_WORK_MODES).nullish(),
  // Self-reported wellbeing check, submitted at clock-out only.
  mood: z.enum(ATTENDANCE_MOODS).nullish(),
});
export type ClockInput = z.infer<typeof clockSchema>;

export const attendanceListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
