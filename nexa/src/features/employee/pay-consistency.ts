/**
 * "ประเภทการจ้าง" (employmentType) and "ประเภทค่าจ้าง" (compensationType) are
 * separate fields, and different screens read different ones: payroll, OT and
 * leave pay read compensationType; the home split, shifts and the daily-worker
 * menu read employmentType. When HR moved a daily worker to ประจำ but left the
 * pay on รายวัน (13 Nov 2026: เฮง, โอ้, นุช), screens disagreed about them.
 * This names the combinations that are almost certainly a half-done change.
 * Pure, so it can be checked on its own.
 */
export function employmentPayMismatch(employmentType: string, compensationType: string): string | null {
  if (employmentType === "DAILY_WORKER" && compensationType !== "DAILY") {
    return "ประเภทการจ้างเป็นรายวัน แต่ประเภทค่าจ้างไม่ใช่รายวัน ระบบเงินเดือนจะไม่คิดค่าแรงรายวันให้ ตรวจแท็บเงินเดือน";
  }
  if ((employmentType === "FULL_TIME" || employmentType === "PROBATION") && compensationType === "DAILY") {
    return "ประเภทการจ้างเป็นพนักงานประจำ แต่ยังคิดค่าจ้างรายวัน ถ้าเปลี่ยนเป็นรายเดือนแล้ว ให้เปลี่ยนประเภทค่าจ้างและใส่เงินเดือนในแท็บเงินเดือนด้วย";
  }
  return null;
}
