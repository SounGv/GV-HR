/** Pure rules for a shift's times (no imports; checked by `node --experimental-strip-types scripts/check-shift-template-rules.mjs`). */

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * What is wrong with a shift's times, or null when they are fine. A shift that ends earlier than it starts runs past
 * midnight (22:00 to 06:00 is a night shift); start equal to end would read as a 24-hour shift, and a break as long as
 * the shift leaves no working time.
 *
 * @param startTime "HH:mm".
 * @param endTime "HH:mm".
 * @param breakMinutes Unpaid break inside the shift.
 */
export function shiftTemplateProblem(startTime: string, endTime: string, breakMinutes: number): string | null {
  if (startTime === endTime) return "เวลาเริ่มและเวลาเลิกต้องไม่เท่ากัน (กะข้ามคืนให้ตั้งเวลาเลิกเป็นเช้าวันถัดไป เช่น 22:00 ถึง 06:00)";
  const length = (minutesOf(endTime) - minutesOf(startTime) + 1440) % 1440;
  if (breakMinutes >= length) return `เวลาพัก ${breakMinutes} นาที ต้องสั้นกว่าความยาวกะ (${length} นาที)`;
  return null;
}
