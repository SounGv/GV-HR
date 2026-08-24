import { z } from "zod";
import { dataUrlOrHttpUrlSchema } from "@/lib/image-schema";

/** Empty string → null so optional fields clear cleanly. */
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max = 200) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
const optEmail = z.preprocess(
  emptyToNull,
  z.string().trim().email("อีเมลไม่ถูกต้อง").max(200).nullable().optional(),
);
const optUrl = z.preprocess(
  emptyToNull,
  z.string().trim().url("ลิงก์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http)").max(500).nullable().optional(),
);
// Images are stored as data URLs or external URLs (cap ~3MB of base64).
const optImage = z.preprocess(emptyToNull, dataUrlOrHttpUrlSchema());

export const companyProfileSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริษัท").max(200),
  legalName: optText(),
  taxId: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(/^\d{13}$/, "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก")
      .nullable()
      .optional(),
  ),

  // Branding
  logoUrl: optImage,
  logoDarkUrl: optImage,
  faviconUrl: optImage,
  signatureUrl: optImage,
  stampUrl: optImage,
  brandColor: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "สีต้องเป็นรหัส HEX เช่น #2563EB")
      .nullable()
      .optional(),
  ),

  // Locale
  timezone: z.string().trim().min(1).max(64).default("Asia/Bangkok"),
  currency: z.string().trim().min(1).max(8).default("THB"),
  language: z.string().trim().min(1).max(8).default("th"),

  // Contact + address
  phone: optText(50),
  email: optEmail,
  website: optUrl,
  googleMapsUrl: optUrl,
  addressLine: optText(300),
  subDistrict: optText(120),
  district: optText(120),
  province: optText(120),
  postalCode: optText(10),
  country: optText(80),

  // Attendance-to-payroll deduction policy
  attendanceDeductionEnabled: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
  lateDeductionPerOccurrence: z.coerce.number().min(0).default(0),

  // Default annual leave quota (days/year) per paid leave type
  leaveQuotaAnnualDays: z.coerce.number().int().min(0).max(365).default(10),
  leaveQuotaSickDays: z.coerce.number().int().min(0).max(365).default(30),
  leaveQuotaPersonalDays: z.coerce.number().int().min(0).max(365).default(3),

  // Separate hourly leave quota (hours/year) — 0 = hourly leave not offered
  // for that type. Never converted to/from the day quota above.
  leaveQuotaSickHours: z.coerce.number().int().min(0).max(999).default(0),
  leaveQuotaPersonalHours: z.coerce.number().int().min(0).max(999).default(0),

  // Medical expense reimbursement cap (baht/year per employee) — see
  // expense/service.ts's assertMedicalExpenseAllowed.
  medicalExpenseCapAmount: z.coerce.number().min(0).max(1_000_000).default(4000),

  // Evaluation score bands (%) — see EvaluationScoreStatus. HR-editable so
  // nothing is hardcoded in the frontend; cross-field order is enforced
  // below so the three cut points can never end up non-ascending.
  evalThresholdUrgentMax: z.coerce.number().min(0).max(100).default(66.67),
  evalThresholdWatchMax: z.coerce.number().min(0).max(100).default(74.99),
  evalThresholdGoodMin: z.coerce.number().min(0).max(100).default(83.33),
})
  .refine((v) => v.evalThresholdUrgentMax < v.evalThresholdWatchMax, {
    message: "เกณฑ์ 'ต้องแก้ไขเร่งด่วน' ต้องน้อยกว่าเกณฑ์ 'ต้องติดตาม'",
    path: ["evalThresholdWatchMax"],
  })
  .refine((v) => v.evalThresholdWatchMax < v.evalThresholdGoodMin, {
    message: "เกณฑ์ 'ต้องติดตาม' ต้องน้อยกว่าเกณฑ์ 'ดี/ดีเยี่ยม'",
    path: ["evalThresholdGoodMin"],
  });

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
