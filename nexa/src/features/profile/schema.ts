import { z } from "zod";
import { DATA_URL_IMAGE_RE } from "@/lib/image-schema";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max = 200) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

export const selfProfileSchema = z.object({
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  // lastName is a required (non-nullable) column — keep it a string (allow empty
  // for single-name employees) rather than null.
  lastName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(100),
  ),
  nickname: optText(60),

  phone: optText(50),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().email("อีเมลไม่ถูกต้อง").max(200).nullable().optional(),
  ),

  gender: z.preprocess(
    emptyToNull,
    z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  ),
  dateOfBirth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง")
      .nullable()
      .optional(),
  ),
  maritalStatus: z.preprocess(
    emptyToNull,
    z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).nullable().optional(),
  ),
  nationalId: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(/^\d{13}$/, "เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก")
      .nullable()
      .optional(),
  ),
  avatarUrl: z.preprocess(
    emptyToNull,
    z.string().max(3_000_000).regex(DATA_URL_IMAGE_RE, "ไฟล์ต้องเป็นรูปภาพ").nullable().optional(),
  ),

  addressLine: optText(300),
  subDistrict: optText(120),
  district: optText(120),
  province: optText(120),
  postalCode: optText(10),
  country: optText(80),

  bankName: optText(80),
  bankAccountNo: optText(40),
  bankBranch: optText(120),

  emergencyContactName: optText(120),
  emergencyContactPhone: optText(50),
  emergencyContactRelation: optText(60),
});

export type SelfProfileInput = z.infer<typeof selfProfileSchema>;
