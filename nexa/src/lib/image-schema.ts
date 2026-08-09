import { z } from "zod";

/**
 * This app has no server-side file-upload endpoint — photos/logos/signatures
 * are all stored as base64 data URLs (client-cropped, size-capped before
 * upload). Without this check, any of these "photo" fields would accept an
 * arbitrary string of the same length — not necessarily an image — since a
 * plain `z.string().max(...)` only bounds size, not content. Validating the
 * `data:image/...;base64,` prefix server-side ensures the stored value is
 * always actually image data, regardless of what a client sends.
 */
export const DATA_URL_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;

/** Optional/nullable image data-URL field, capped at `maxBytes` (default ~3MB as a base64 string). */
export function dataUrlImageSchema(maxBytes = 3_000_000) {
  return z
    .string()
    .max(maxBytes, "รูปภาพมีขนาดใหญ่เกินไป")
    .regex(DATA_URL_IMAGE_RE, "ไฟล์ต้องเป็นรูปภาพ (PNG, JPEG, WEBP, หรือ GIF)")
    .nullable()
    .optional();
}

const HTTP_URL_RE = /^https?:\/\//;

/**
 * For the handful of image fields (company logo/signature/stamp) that accept
 * either an uploaded data URL (the normal path, via the file picker) or a
 * pasted external https URL (e.g. a CDN-hosted asset) — still rejects
 * anything that's neither, so it can't be repurposed to store arbitrary text.
 */
export function dataUrlOrHttpUrlSchema(maxBytes = 3_000_000) {
  return z
    .string()
    .max(maxBytes, "ค่านี้ยาวเกินไป")
    .refine(
      (v) => DATA_URL_IMAGE_RE.test(v) || HTTP_URL_RE.test(v),
      "ต้องเป็นรูปภาพที่อัปโหลด หรือลิงก์ http(s) เท่านั้น",
    )
    .nullable()
    .optional();
}

/** Any client-uploaded file, not just images (e.g. a PDF/doc résumé). */
const DATA_URL_ANY_RE = /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/;

/**
 * Same idea as `dataUrlOrHttpUrlSchema`, but for attachments that aren't
 * necessarily images (résumés, documents) — accepts any `data:...;base64,`
 * payload or a pasted https URL.
 */
export function dataUrlFileOrHttpUrlSchema(maxBytes = 3_000_000) {
  return z
    .string()
    .max(maxBytes, "ไฟล์มีขนาดใหญ่เกินไป")
    .refine(
      (v) => DATA_URL_ANY_RE.test(v) || HTTP_URL_RE.test(v),
      "ต้องเป็นไฟล์ที่อัปโหลด หรือลิงก์ http(s) เท่านั้น",
    )
    .nullable()
    .optional();
}
