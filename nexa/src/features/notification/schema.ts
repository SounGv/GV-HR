import { z } from "zod";

export const sendNotificationSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกผู้รับอย่างน้อย 1 คน").max(500),
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(200),
  body: z.string().trim().min(1, "กรุณากรอกข้อความ").max(2000),
});
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
