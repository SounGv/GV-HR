"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { formatCurrency, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  note?: string | null;
  employee: { employeeCode: string; firstName: string; lastName: string };
}

/**
 * Paper sizes HR can print on. `page` feeds the CSS `@page size` rule
 * directly (named size, or "<width> <height>" for the non-standard stub).
 * `compact` switches the document to a stacked single-column layout with
 * smaller type — the A4 two-column layout simply doesn't fit A6 or the
 * continuous-stationery stub, so it isn't just scaled down, it's reflowed.
 */
const PAPER_SIZES = [
  { key: "A4", label: "A4", page: "A4", margin: "14mm", compact: false },
  { key: "A5", label: "A5", page: "A5", margin: "10mm", compact: false },
  { key: "A6", label: "A6", page: "A6", margin: "6mm", compact: true },
  { key: "STUB", label: "9 x 5.5 นิ้ว", page: "228.6mm 139.7mm", margin: "6mm", compact: true },
] as const;
type PaperKey = (typeof PAPER_SIZES)[number]["key"];

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
  const [paperKey, setPaperKey] = useState<PaperKey>("A4");
  const paper = PAPER_SIZES.find((p) => p.key === paperKey)!;

  return (
    <div className={cn("mx-auto p-4 print:p-0", paper.compact ? "max-w-md" : "max-w-3xl")}>
      {/* Print-only page setup + hide the toolbar — size follows the HR-selected paper */}
      <style>{`@page { size: ${paper.page}; margin: ${paper.margin}; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> กลับ
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {PAPER_SIZES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPaperKey(p.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  paperKey === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Printer className="size-4" /> พิมพ์ / บันทึก PDF / ดาวน์โหลด
          </button>
        </div>
      </div>

      {/* Document */}
      <div
        className={cn(
          "rounded-xl border border-border bg-white text-slate-900 shadow-sm print:border-0 print:shadow-none",
          paper.compact ? "p-4 text-xs print:p-0" : "p-8 print:p-0",
        )}
      >
        <header className={cn("flex items-start justify-between gap-4 border-b border-slate-200", paper.compact ? "pb-2" : "pb-4")}>
          <div className="flex items-start gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className={cn("w-auto object-contain", paper.compact ? "h-8" : "h-14")} />
            ) : null}
            <div>
              <p className={cn("font-bold", paper.compact ? "text-sm" : "text-lg")}>{company.legalName ?? company.name}</p>
              {!paper.compact && <p className="text-xs text-slate-500">{companyAddress(company)}</p>}
              {!paper.compact && company.taxId && <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className={cn("font-semibold", paper.compact ? "text-xs" : "text-base")}>สลิปเงินเดือน</p>
            <p className={cn("font-medium", paper.compact ? "text-[10px]" : "mt-1 text-sm")}>{slip.periodLabel}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${slip.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {slip.status === "PAID" ? "จ่ายแล้ว" : "ฉบับร่าง"}
            </span>
          </div>
        </header>

        <div className={cn("grid grid-cols-2 gap-4 text-sm", paper.compact ? "py-2 text-xs" : "py-4")}>
          <div>
            <p className="text-xs text-slate-500">พนักงาน</p>
            <p className="font-medium">{name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">รหัสพนักงาน</p>
            <p className="font-medium">{slip.employee.employeeCode}</p>
          </div>
        </div>

        <div className={cn("grid gap-4", paper.compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          <table className={cn("w-full", paper.compact ? "text-xs" : "text-sm")}>
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

          <table className={cn("w-full", paper.compact ? "text-xs" : "text-sm")}>
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

        {slip.note && (
          <p className={cn("mt-3 rounded-md bg-slate-50 px-3 py-2 text-slate-600", paper.compact ? "text-[10px]" : "text-xs")}>
            <span className="font-medium text-slate-700">หมายเหตุจาก HR: </span>
            {slip.note}
          </p>
        )}

        <div className={cn("mt-4 flex items-center justify-between rounded-lg bg-slate-900 text-white print:bg-slate-900", paper.compact ? "px-3 py-2" : "px-5 py-4")}>
          <span className="font-medium">เงินเดือนสุทธิ (Net Pay)</span>
          <span className="text-xl font-bold tabular-nums">{formatCurrency(slip.net)}</span>
        </div>

        <footer className={cn("flex items-end justify-between gap-4", paper.compact ? "mt-3" : "mt-6")}>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR ตรวจสอบ" className={paper.compact ? "size-14" : "size-24"} />
            <div className="text-xs text-slate-500">
              {!paper.compact && <p className="font-medium text-slate-700">สแกนเพื่อตรวจสอบความถูกต้อง</p>}
              {!paper.compact && <p className="mt-0.5 break-all">{verifyUrl}</p>}
              <p className={paper.compact ? "text-[10px]" : "mt-1"}>อ้างอิง {slip.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="text-center">
            <div className={cn("flex items-end justify-center", paper.compact ? "h-8" : "h-16")}>
              {company.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.signatureUrl} alt="ลายเซ็น" className={cn("object-contain", paper.compact ? "max-h-8" : "max-h-16")} />
              ) : null}
              {company.stampUrl && !paper.compact ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.stampUrl} alt="ตราประทับ" className="ml-1 max-h-16 object-contain opacity-80" />
              ) : null}
            </div>
            <div className="mt-1 border-t border-slate-300 pt-1 text-[10px] text-slate-500">
              ผู้มีอำนาจลงนาม
            </div>
          </div>
        </footer>

        {!paper.compact && (
          <p className="mt-4 text-center text-[10px] text-slate-400">
            เอกสารนี้ออกโดยระบบ GV One HR — {company.name}
          </p>
        )}
      </div>
    </div>
  );
}
