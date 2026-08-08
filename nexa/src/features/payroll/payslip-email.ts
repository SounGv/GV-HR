import { formatCurrency, fullName } from "@/lib/format";
import type { PayrollLineItem } from "./types";

export interface PayslipEmailRecord {
  id: string;
  periodLabel: string;
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  gross: number;
  totalDeductions: number;
  net: number;
  status: "DRAFT" | "PAID";
  employee: { employeeCode: string; firstName: string; lastName: string };
}

export interface PayslipEmailCompany {
  name: string;
  legalName: string | null;
  taxId: string | null;
  addressLine: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
}

function companyAddress(c: PayslipEmailCompany): string {
  return [c.addressLine, c.subDistrict, c.district, c.province, c.postalCode].filter(Boolean).join(" ");
}

function lineItemRows(items: PayrollLineItem[]): string {
  return items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0;color:#334155;">${i.label}</td><td style="padding:4px 0;text-align:right;color:#334155;">${i.amount.toLocaleString("th-TH")}</td></tr>`,
    )
    .join("");
}

/**
 * Inline-styled HTML only — email clients don't render Tailwind/CSS classes,
 * and base64-embedded images (QR/signature/stamp) are unreliable across
 * clients, so this mirrors payslip-document.tsx's data but with a plain
 * text verify link instead of an embedded QR image.
 */
export function renderPayslipEmailHtml({
  record,
  company,
  verifyUrl,
}: {
  record: PayslipEmailRecord;
  company: PayslipEmailCompany;
  verifyUrl: string;
}): string {
  const name = fullName(record.employee.firstName, record.employee.lastName);
  const statusLabel = record.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง";

  return `
<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
  <div style="border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
    <p style="margin:0;font-size:16px;font-weight:700;">${company.legalName ?? company.name}</p>
    <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${companyAddress(company)}</p>
    ${company.taxId ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">เลขประจำตัวผู้เสียภาษี ${company.taxId}</p>` : ""}
  </div>

  <p style="margin:0 0 4px;font-size:15px;font-weight:600;">สลิปเงินเดือน · ${record.periodLabel}</p>
  <p style="margin:0 0 16px;font-size:12px;color:#64748b;">สถานะ: ${statusLabel}</p>

  <table style="width:100%;font-size:14px;margin-bottom:12px;">
    <tr>
      <td style="color:#64748b;font-size:12px;">พนักงาน</td>
      <td style="color:#64748b;font-size:12px;text-align:right;">รหัสพนักงาน</td>
    </tr>
    <tr>
      <td style="font-weight:600;">${name}</td>
      <td style="font-weight:600;text-align:right;">${record.employee.employeeCode}</td>
    </tr>
  </table>

  <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:8px;">
    <tr style="border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">
      <td style="padding:4px 0;">รายได้</td>
      <td style="padding:4px 0;text-align:right;">บาท</td>
    </tr>
    ${lineItemRows(record.earnings)}
    <tr style="font-weight:700;border-top:1px solid #e2e8f0;">
      <td style="padding:4px 0;">รวมรายได้</td>
      <td style="padding:4px 0;text-align:right;">${record.gross.toLocaleString("th-TH")}</td>
    </tr>
  </table>

  <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;">
    <tr style="border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">
      <td style="padding:4px 0;">รายการหัก</td>
      <td style="padding:4px 0;text-align:right;">บาท</td>
    </tr>
    ${lineItemRows(record.deductions)}
    <tr style="font-weight:700;border-top:1px solid #e2e8f0;">
      <td style="padding:4px 0;">รวมรายการหัก</td>
      <td style="padding:4px 0;text-align:right;">${record.totalDeductions.toLocaleString("th-TH")}</td>
    </tr>
  </table>

  <table style="width:100%;background:#0f172a;border-radius:8px;">
    <tr>
      <td style="padding:14px 16px;color:#ffffff;font-weight:600;">เงินเดือนสุทธิ (Net Pay)</td>
      <td style="padding:14px 16px;color:#ffffff;font-weight:700;font-size:18px;text-align:right;">${formatCurrency(record.net)}</td>
    </tr>
  </table>

  <p style="margin:16px 0 0;font-size:12px;color:#64748b;">
    ตรวจสอบความถูกต้องของสลิปนี้ได้ที่ <a href="${verifyUrl}" style="color:#7a35ff;">${verifyUrl}</a><br/>
    รหัสอ้างอิง: ${record.id.slice(0, 8)}
  </p>
  <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;text-align:center;">เอกสารนี้ออกโดยระบบ GV One HR — ${company.name}</p>
</div>`.trim();
}
