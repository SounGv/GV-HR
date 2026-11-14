/**
 * What staff are told when the AI service itself fails. The technical message stays in the server log; the person
 * gets what happened and who has to act, in plain Thai with no key names or English errors. No imports, so
 * scripts/check-ai-error.mjs can test it directly.
 */

export const AI_FAILURE_DEFAULT = "น้องวีบอทตอบไม่ได้ตอนนี้ ลองถามใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้ง HR";

/** @param status HTTP status the AI service returned, when there was one. @param message Its raw message (used only to tell causes apart). */
export function describeAiFailure(status: number | undefined, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("credit balance") || m.includes("billing")) {
    return "น้องวีบอทใช้ไม่ได้ชั่วคราว เครดิตของบริการ AI หมด แจ้งผู้ดูแลระบบให้เติมเครดิตแล้วลองใหม่ ข้อมูลในระบบไม่ได้หายหรือเปลี่ยน";
  }
  if (status === 401 || status === 403 || m.includes("invalid x-api-key") || m.includes("authentication")) {
    return "น้องวีบอทเชื่อมต่อบริการ AI ไม่ได้ เพราะรหัสเชื่อมต่อใช้ไม่ได้ แจ้งผู้ดูแลระบบให้ตรวจการตั้งค่า";
  }
  if (status === 429 || m.includes("rate limit")) {
    return "มีคนถามน้องวีบอทพร้อมกันมากเกินไป รอสักครู่แล้วลองถามใหม่";
  }
  if (status === 529 || status === 503 || m.includes("overloaded")) {
    return "บริการ AI กำลังยุ่งมาก รอสักครู่แล้วลองถามใหม่";
  }
  return AI_FAILURE_DEFAULT;
}
