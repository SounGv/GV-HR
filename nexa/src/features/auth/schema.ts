import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password-policy";

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
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "ลิงก์ไม่ถูกต้อง"),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const mfaVerifySchema = z.object({
  mfaToken: z.string().trim().min(1),
  code: z.string().trim().min(1, "กรุณากรอกรหัสยืนยัน"),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(1, "กรุณากรอกรหัสยืนยัน"),
});
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;
