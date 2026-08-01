"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { formatCurrency, fullName } from "@/lib/format";
import type { PayrollLineItem } from "./types";

export interface PayslipDocData {
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

export interface PayslipCompany {
  name: string;
  legalName: string | null;
  taxId: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  stampUrl: string | null;
  addressLine: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
}

function companyAddress(c: PayslipCompany): string {
  return [c.addressLine, c.subDistrict, c.district, c.province, c.postalCode]
    .filter(Boolean)
    .join(" ");
}

export function PayslipDocument({
  slip,
  company,
  qr,
  verifyUrl,
  backHref = "/payroll",
}: {
  slip: PayslipDocData;
  company: PayslipCompany;
  qr: string;
  verifyUrl: string;
  backHref?: string;
}) {
  const name = fullName(slip.employee.firstName, slip.employee.lastName);

  return (
    <div className="mx-auto max-w-3xl p-4 print:p-0">
      {/* Print-only page setup + hide the toolbar */}
      <style>{`@page { size: A4; margin: 14mm; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> กลับ
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Printer className="size-4" /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      {/* Document */}
      <div className="rounded-xl border border-border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-14 w-auto object-contain" />
            ) : null}
            <div>
              <p className="text-lg font-bold">{company.legalName ?? company.name}</p>
              <p className="text-xs text-slate-500">{companyAddress(company)}</p>
              {company.taxId && <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
              {company.phone && <p className="text-xs text-slate-500">โทร. {company.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold">สลิปเงินเดือน</p>
            <p className="text-xs text-slate-500">Payslip</p>
            <p className="mt-1 text-sm font-medium">{slip.periodLabel}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${slip.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {slip.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง"}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">พนักงาน</p>
            <p className="font-medium">{name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">รหัสพนักงาน</p>
            <p className="font-medium">{slip.employee.employeeCode}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">รายได้</th>
                <th className="py-1.5 text-right">บาท</th>
              </tr>
            </thead>
            <tbody>
              {slip.earnings.map((e, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5">{e.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{e.amount.toLocaleString("th-TH")}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">รวมรายได้</td>
                <td className="py-1.5 text-right tabular-nums">{slip.gross.toLocaleString("th-TH")}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">รายการหัก</th>
                <th className="py-1.5 text-right">บาท</th>
              </tr>
            </thead>
            <tbody>
              {slip.deductions.map((d, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5">{d.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.amount.toLocaleString("th-TH")}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">รวมรายการหัก</td>
                <td className="py-1.5 text-right tabular-nums">{slip.totalDeductions.toLocaleString("th-TH")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-4 text-white print:bg-slate-900">
          <span className="font-medium">เงินเดือนสุทธิ (Net Pay)</span>
          <span className="text-xl font-bold tabular-nums">{formatCurrency(slip.net)}</span>
        </div>

        <footer className="mt-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR ตรวจสอบ" className="size-24" />
            <div className="text-xs text-slate-500">
              <p className="font-medium text-slate-700">สแกนเพื่อตรวจสอบความถูกต้อง</p>
              <p className="mt-0.5 break-all">{verifyUrl}</p>
              <p className="mt-1">รหัสอ้างอิง: {slip.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="flex h-16 items-end justify-center">
              {company.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.signatureUrl} alt="ลายเซ็น" className="max-h-16 object-contain" />
              ) : null}
              {company.stampUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.stampUrl} alt="ตราประทับ" className="ml-1 max-h-16 object-contain opacity-80" />
              ) : null}
            </div>
            <div className="mt-1 border-t border-slate-300 pt-1 text-xs text-slate-500">
              ผู้มีอำนาจลงนาม
            </div>
          </div>
        </footer>

        <p className="mt-4 text-center text-[10px] text-slate-400">
          เอกสารนี้ออกโดยระบบ NEXA HR — {company.name}
        </p>
      </div>
    </div>
  );
}
