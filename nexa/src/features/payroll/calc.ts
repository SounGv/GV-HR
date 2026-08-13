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

export type CompensationType = "MONTHLY" | "DAILY" | "HOURLY";

export interface PayrollInput {
  // Whatever this period's base pay already comes out to — a fixed monthly
  // amount for MONTHLY, or dailyRate × days-actually-worked / hourlyRate ×
  // hours-actually-worked for DAILY/HOURLY (the caller does that
  // multiplication; this function only needs the result). Only changes the
  // earnings line's label, not how it's summed.
  baseSalary: number;
  compensationType?: CompensationType;
  allowances?: number; // fixed monthly allowances (position, cost of living…)
  overtime?: number; // approved OT amount for the period
  bonus?: number;
  otherEarnings?: number;
  providentFundRate?: number; // employee PF contribution, % of base salary
  loan?: number; // monthly loan repayment
  advance?: number; // salary advance recovery
  // Approved unpaid-leave days within this period — deducted at the same
  // daily rate (baseSalary / 30) the overtime calc already uses, so the two
  // stay consistent with each other. Only meaningful for MONTHLY employees —
  // DAILY/HOURLY pay is already computed from days/hours actually worked, so
  // an unpaid-leave day was never counted as worked in the first place and
  // deducting it again here would double-count it.
  unpaidLeaveDays?: number;
  // HR-entered ad-hoc line items for this period (bonus/allowance/advance/other
  // that don't come from an automatic source like approved OT) — added on top
  // of the computed lines below, and included in gross/deduction/net totals.
  extraEarnings?: LineItem[];
  extraDeductions?: LineItem[];
}

const BASE_PAY_LABEL: Record<CompensationType, string> = {
  MONTHLY: "เงินเดือน",
  DAILY: "ค่าจ้างรายวัน",
  HOURLY: "ค่าจ้างรายชั่วโมง",
};

/** Thailand personal income tax brackets (annual net taxable income). */
const TAX_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

/** Progressive annual income tax on net taxable income. */
export function annualIncomeTax(annualTaxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const b of TAX_BRACKETS) {
    if (annualTaxable <= lower) break;
    tax += (Math.min(annualTaxable, b.upTo) - lower) * b.rate;
    lower = b.upTo;
  }
  return Math.max(0, tax);
}

/**
 * Compute a monthly payslip (Thailand).
 *  - Social Security: 5% of wage, floored at 1,650 / capped at 15,000 → 83–750 THB.
 *  - Provident fund: employee % of base salary (optional).
 *  - Withholding tax: monthly estimate = annualIncomeTax(annualized income −
 *    50% expense (cap 100k) − 60k personal allowance − SS (cap 9k) − PF) / 12.
 */
export function computePayroll(input: PayrollInput): PayrollComputation {
  const salary = Math.round(input.baseSalary);
  const allowances = Math.round(input.allowances ?? 0);
  const overtime = Math.round(input.overtime ?? 0);
  const bonus = Math.round(input.bonus ?? 0);
  const other = Math.round(input.otherEarnings ?? 0);
  const pfRate = Math.max(0, input.providentFundRate ?? 0);
  const loan = Math.round(input.loan ?? 0);
  const advance = Math.round(input.advance ?? 0);
  const unpaidLeaveDays = Math.max(0, input.unpaidLeaveDays ?? 0);
  const unpaidLeaveDeduction = Math.round((salary / 30) * unpaidLeaveDays);

  const earnings: LineItem[] = [{ label: BASE_PAY_LABEL[input.compensationType ?? "MONTHLY"], amount: salary }];
  if (allowances) earnings.push({ label: "ค่าตำแหน่ง/เบี้ยเลี้ยง", amount: allowances });
  if (overtime) earnings.push({ label: "ค่าล่วงเวลา (OT)", amount: overtime });
  if (bonus) earnings.push({ label: "โบนัส", amount: bonus });
  if (other) earnings.push({ label: "รายได้อื่นๆ", amount: other });
  for (const e of input.extraEarnings ?? []) {
    if (e.amount) earnings.push({ label: e.label, amount: Math.round(e.amount) });
  }
  const gross = earnings.reduce((s, e) => s + e.amount, 0);

  const ssBase = Math.min(Math.max(salary, 1650), 15000);
  const socialSecurity = Math.min(Math.round(ssBase * 0.05), 750);
  const providentFund = Math.round(salary * (pfRate / 100));

  const annualIncome = gross * 12;
  const expenseDeduction = Math.min(annualIncome * 0.5, 100_000);
  const personalAllowance = 60_000;
  const ssAnnual = Math.min(socialSecurity * 12, 9_000);
  const pfAnnual = providentFund * 12;
  const annualTaxable = Math.max(
    0,
    annualIncome - expenseDeduction - personalAllowance - ssAnnual - pfAnnual,
  );
  const tax = Math.round(annualIncomeTax(annualTaxable) / 12);

  const deductions: LineItem[] = [{ label: "ประกันสังคม", amount: socialSecurity }];
  if (tax) deductions.push({ label: "ภาษีหัก ณ ที่จ่าย", amount: tax });
  if (providentFund) deductions.push({ label: "กองทุนสำรองเลี้ยงชีพ", amount: providentFund });
  if (loan) deductions.push({ label: "หักชำระเงินกู้", amount: loan });
  if (advance) deductions.push({ label: "หักเบิกล่วงหน้า", amount: advance });
  if (unpaidLeaveDeduction) deductions.push({ label: "หักลาไม่รับค่าจ้าง", amount: unpaidLeaveDeduction });
  for (const d of input.extraDeductions ?? []) {
    if (d.amount) deductions.push({ label: d.label, amount: Math.round(d.amount) });
  }
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
