import { z } from "zod";

export const MEETING_STATUSES = ["SCHEDULED", "CANCELLED"] as const;
export const MEETING_RESPONSE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;

export const meetingCreateSchema = z
  .object({
    title: z.string().trim().min(1, "กรุณาระบุหัวข้อการประชุม").max(200),
    description: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(2000).optional(),
    ),
    location: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(200).optional(),
    ),
    startAt: z.coerce.date({ message: "กรุณาเลือกวันและเวลาเริ่ม" }),
    endAt: z.coerce.date({ message: "กรุณาเลือกวันและเวลาสิ้นสุด" }),
    attendeeEmployeeIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกผู้เข้าร่วมอย่างน้อย 1 คน"),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endAt"],
  });
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;

export const meetingRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});
export type MeetingRespondInput = z.infer<typeof meetingRespondSchema>;

export const meetingListQuerySchema = z.object({
  scope: z.enum(["organizer", "invitee"]).default("invitee"),
});
export type MeetingListQuery = z.infer<typeof meetingListQuerySchema>;
