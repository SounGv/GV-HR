export interface LineItem {
  label: string;
  amount: number;
}

export interface PayrollComputation {
  earnings: LineItem[];
  deductions: LineItem[];
  gross: number;
  totalDeductions: number;
  net: number;
}

/**
 * Compute a monthly payslip from base salary.
 *
 * Social Security (Thailand): 5% of the assessable wage, which is floored at
 * 1,650 and capped at 15,000 THB — i.e. a monthly SS deduction between 83 and
 * 750 THB. Withholding tax is intentionally left at 0 here; a configurable tax
 * table can be layered on without changing callers.
 */
export function computePayroll(baseSalary: number): PayrollComputation {
  const salary = Math.round(baseSalary);
  const earnings: LineItem[] = [{ label: "เงินเดือน", amount: salary }];
  const gross = earnings.reduce((s, e) => s + e.amount, 0);

  const ssBase = Math.min(Math.max(salary, 1650), 15000);
  const socialSecurity = Math.min(Math.round(ssBase * 0.05), 750);
  const deductions: LineItem[] = [{ label: "ประกันสังคม", amount: socialSecurity }];
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  return { earnings, deductions, gross, totalDeductions, net: gross - totalDeductions };
}

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-07" → "กรกฎาคม 2569" (Buddhist year). */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${MONTHS_TH[m - 1]} ${y + 543}`;
}

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}
