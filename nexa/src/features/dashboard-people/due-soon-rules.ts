/**
 * The "ใกล้ครบกำหนด" list on HR's home page: year-end set-up that has to be done before 1 January.
 * Pure rules (no database), so the dates and the wording can be checked on their own.
 */

export interface DueSoonInput {
  /** Bangkok calendar date today. */
  year: number;
  month: number;
  day: number;
  /** Holidays already entered for next year. */
  holidaysNextYear: number;
  /** People who have leave entitlements this year, and next year so far. */
  balancePeopleThisYear: number;
  balancePeopleNextYear: number;
  canSetHolidays: boolean;
  canSetLeaveYear: boolean;
}

export interface DueSoonItem {
  key: "holidays" | "leave-year";
  title: string;
  sub: string;
  /** Days until 1 January of next year (0 on the day). */
  daysLeft: number;
  href: string;
  action: string;
}

/** First month the list starts to appear: three months before the new year gives time to prepare. */
export const DUE_SOON_FROM_MONTH = 10;

/** Whole days from the given Bangkok date to 1 January of the next year. */
export function daysToNewYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, month - 1, day)) / 86_400_000);
}

export function dueSoonItems(i: DueSoonInput): DueSoonItem[] {
  if (i.month < DUE_SOON_FROM_MONTH) return [];
  const be = i.year + 1 + 543;
  const daysLeft = daysToNewYear(i.year, i.month, i.day);
  const items: DueSoonItem[] = [];

  if (i.canSetLeaveYear && i.balancePeopleThisYear > 0 && i.balancePeopleNextYear < i.balancePeopleThisYear) {
    items.push({
      key: "leave-year",
      title: `ตั้งสิทธิ์ลาปี ${be}`,
      sub:
        i.balancePeopleNextYear === 0
          ? `ยังไม่ได้ตั้งให้ใครเลย ปี ${be - 1} ตั้งไว้ให้ ${i.balancePeopleThisYear} คน`
          : `ตั้งแล้ว ${i.balancePeopleNextYear} จาก ${i.balancePeopleThisYear} คน`,
      daysLeft,
      href: "/leave/year-setup",
      action: "ตั้งสิทธิ์ลา",
    });
  }
  if (i.canSetHolidays && i.holidaysNextYear === 0) {
    items.push({
      key: "holidays",
      title: `วันหยุดปี ${be} ยังไม่ได้ใส่`,
      sub: "ในระบบยังไม่มีวันหยุดของปีหน้า วันลาและการนับวันทำงานจะคลาดเคลื่อน",
      daysLeft,
      href: "/holidays",
      action: "ใส่วันหยุด",
    });
  }
  return items;
}
