import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  companyName: z.string().trim().min(1, "กรุณากรอกชื่อองค์กร").max(160),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(80),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(80),
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร").max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
