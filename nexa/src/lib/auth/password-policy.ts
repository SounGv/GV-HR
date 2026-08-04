import { z } from "zod";

/**
 * Shared password complexity rule: 8+ chars, at least one lowercase,
 * one uppercase, one digit. Used by registration, HR-created employee
 * accounts, and both password-reset flows so the policy can't drift
 * between them.
 */
export const passwordSchema = z
  .string()
  .min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร")
  .max(100, "รหัสผ่านยาวเกินไป")
  .regex(/[a-z]/, "ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว")
  .regex(/[A-Z]/, "ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว")
  .regex(/[0-9]/, "ต้องมีตัวเลขอย่างน้อย 1 ตัว");

const GEN_LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l/o — avoid look-alikes
const GEN_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
const GEN_DIGIT = "23456789"; // no 0/1
const GEN_ALL = GEN_LOWER + GEN_UPPER + GEN_DIGIT;

function randomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Generates a random password guaranteed to satisfy `passwordSchema`. */
export function generateStrongPassword(length = 12): string {
  const required = [randomChar(GEN_LOWER), randomChar(GEN_UPPER), randomChar(GEN_DIGIT)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => randomChar(GEN_ALL));
  const chars = [...required, ...rest];
  // Shuffle so the guaranteed chars aren't always in the first 3 positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
