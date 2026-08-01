import { z } from "zod";

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
const optImage = z.preprocess(emptyToNull, z.string().max(3_000_000).nullable().optional());

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
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
