"use client";

import { useState } from "react";
import { Building2, FileSpreadsheet, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fullName } from "@/lib/format";
import type { PayrollRecord } from "./types";

/**
 * Bank-transfer / ภ.ง.ด. / SSO exports — the underlying numbers (net pay,
 * withholding tax, SSO contribution) are all real, already-calculated
 * payroll data. What's NOT yet confirmed is the exact byte-for-byte layout
 * each destination (K-Cash Connect Plus, RD Prep, SSO e-Service) expects —
 * those specs are only handed out to registered corporate users, not
 * published publicly. This ships a clean, correctly-labeled Excel export of
 * the right data now; once HR gets the actual template from the bank/RD/SSO,
 * the column order here can be adjusted to match exactly.
 */

function findDeduction(record: PayrollRecord, label: string): number {
  // Standard computed items ("ประกันสังคม" / "ภาษีหัก ณ ที่จ่าย") always land in
  // `deductions` — `manualAdjustments` is only for HR's ad-hoc line items
  // (bonus, loan repayment) added on top, never a replacement for these.
  return record.deductions.find((d) => d.label === label)?.amount ?? 0;
}

async function downloadSheet(rows: (string | number)[][], header: string[], sheetName: string, fileName: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName);
}

export function PayrollFilingExports({ records, period }: { records: PayrollRecord[]; period: string }) {
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  function withEmployee(fn: (rows: PayrollRecord[]) => void) {
    const rows = records.filter((r) => r.employee);
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลเงินเดือนในงวดนี้");
      return;
    }
    fn(rows);
  }

  async function exportBankTransfer() {
    withEmployee(async (rows) => {
      const missingBank = rows.filter((r) => !r.employee!.bankName || !r.employee!.bankAccountNo);
      const header = ["รหัสพนักงาน", "ชื่อ-นามสกุล", "ธนาคาร", "เลขที่บัญชี", "จำนวนเงิน (บาท)"];
      const body = rows.map((r) => [
        r.employee!.employeeCode,
        fullName(r.employee!.firstName, r.employee!.lastName),
        r.employee!.bankName ?? "(ไม่มีข้อมูลธนาคาร)",
        r.employee!.bankAccountNo ?? "(ไม่มีเลขบัญชี)",
        r.net,
      ]);
      await downloadSheet(body, header, "โอนเงินเดือน", `bank-transfer_${period}.xlsx`);
      toast.success(
        missingBank.length > 0
          ? `ดาวน์โหลดแล้ว — แต่มี ${missingBank.length} คนไม่มีข้อมูลธนาคาร กรุณาตรวจสอบก่อนโอน`
          : "ดาวน์โหลดไฟล์โอนเงินเดือนแล้ว",
      );
      setPendingNotice("bank");
    });
  }

  async function exportTaxFiling() {
    withEmployee(async (rows) => {
      const header = ["เลขบัตรประชาชน", "ชื่อ-นามสกุล", "เงินได้ที่จ่าย (บาท)", "ภาษีหัก ณ ที่จ่าย (บาท)"];
      const body = rows.map((r) => [
        r.employee!.nationalId ?? "(ไม่มีเลขบัตรประชาชน)",
        fullName(r.employee!.firstName, r.employee!.lastName),
        r.gross,
        findDeduction(r, "ภาษีหัก ณ ที่จ่าย"),
      ]);
      await downloadSheet(body, header, "ภงด", `tax-filing_${period}.xlsx`);
      toast.success("ดาวน์โหลดไฟล์ข้อมูลภาษีแล้ว");
      setPendingNotice("tax");
    });
  }

  async function exportSsoFiling() {
    withEmployee(async (rows) => {
      const header = [
        "เลขบัตรประชาชน",
        "ชื่อ-นามสกุล",
        "ค่าจ้าง (ฐานคำนวณโดยประมาณ)",
        "เงินสมทบฝ่ายลูกจ้าง (บาท)",
        "เงินสมทบฝ่ายนายจ้าง (บาท)",
      ];
      const body = rows.map((r) => {
        const contribution = findDeduction(r, "ประกันสังคม");
        const wageBase = contribution >= 750 ? 15000 : Math.round(contribution / 0.05);
        return [
          r.employee!.nationalId ?? "(ไม่มีเลขบัตรประชาชน)",
          fullName(r.employee!.firstName, r.employee!.lastName),
          wageBase,
          contribution,
          contribution,
        ];
      });
      await downloadSheet(body, header, "สปส", `sso-filing_${period}.xlsx`);
      toast.success("ดาวน์โหลดไฟล์ข้อมูลประกันสังคมแล้ว");
      setPendingNotice("sso");
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportBankTransfer}>
          <Landmark className="size-4" /> ไฟล์โอนเงินธนาคาร
        </Button>
        <Button variant="outline" size="sm" onClick={exportTaxFiling}>
          <FileSpreadsheet className="size-4" /> ไฟล์ยื่นภาษี (ภ.ง.ด.)
        </Button>
        <Button variant="outline" size="sm" onClick={exportSsoFiling}>
          <ShieldCheck className="size-4" /> ไฟล์นำส่งประกันสังคม
        </Button>
      </div>

      <Dialog open={!!pendingNotice} onOpenChange={(o) => !o && setPendingNotice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-warning" /> รูปแบบไฟล์ยังไม่ตรงกับหน่วยงาน 100%
            </DialogTitle>
            <DialogDescription>
              ไฟล์นี้มีข้อมูลที่ถูกต้องครบถ้วน แต่ยังเป็นรูปแบบทั่วไป — ยังไม่ได้ปรับให้ตรงกับฟอร์แมตที่
              {pendingNotice === "bank" ? " K-Cash Connect Plus" : pendingNotice === "tax" ? " RD Prep (กรมสรรพากร)" : " สปส. e-Service"}
              {" "}ต้องการเป๊ะ เนื่องจากยังไม่มีเอกสารสเปกอย่างเป็นทางการ — ใช้เป็นข้อมูลอ้างอิงไปกรอกเอง หรือส่งให้ผู้ดูแลระบบปรับฟอร์แมตเมื่อได้รับเอกสารจากหน่วยงานแล้ว
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
