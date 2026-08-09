"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GenericImportCenter } from "@/components/shared/generic-import-center";
import { importPayrollAdjustmentsApi } from "./api";

const HEADER_ALIASES: Record<string, string> = {
  รหัสพนักงาน: "employeeCode", รหัส: "employeeCode", employeecode: "employeeCode", code: "employeeCode",
  งวด: "period", period: "period",
  รายการ: "label", label: "label",
  ประเภท: "type", type: "type",
  จำนวนเงิน: "amount", amount: "amount",
};

const COLUMN_LABEL: Record<string, string> = {
  employeeCode: "รหัส", period: "งวด (YYYY-MM)", label: "รายการ", type: "ประเภท (earning/deduction)", amount: "จำนวนเงิน",
};

const COLUMNS = ["employeeCode", "period", "label", "type", "amount"];
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function validateRow(data: Record<string, string>): string | null {
  if (!data.employeeCode) return "ไม่มีรหัสพนักงาน";
  if (!data.period || !PERIOD_RE.test(data.period)) return "งวดต้องเป็น YYYY-MM";
  if (!data.label) return "ไม่มีชื่อรายการ";
  if (data.type !== "earning" && data.type !== "deduction") return "ประเภทต้องเป็น earning หรือ deduction";
  if (!data.amount || Number.isNaN(Number(data.amount)) || Number(data.amount) < 0) return "จำนวนเงินไม่ถูกต้อง";
  return null;
}

export function PayrollImportView() {
  const qc = useQueryClient();
  return (
    <GenericImportCenter
      description="คอลัมน์: รหัสพนักงาน, งวด (YYYY-MM), รายการ, ประเภท (earning/deduction), จำนวนเงิน — ต้องออกรอบเงินเดือนของงวดนั้นไว้ก่อนแล้ว"
      columns={COLUMNS}
      columnLabels={COLUMN_LABEL}
      headerAliases={HEADER_ALIASES}
      requiredColumns={["employeeCode", "period", "label", "type", "amount"]}
      validateRow={validateRow}
      templateHeaders="รหัสพนักงาน,งวด,รายการ,ประเภท,จำนวนเงิน"
      templateSample="2001,2026-08,โบนัสไตรมาส,earning,5000"
      templateFilename="payroll-import-template.csv"
      onImport={(rows) => importPayrollAdjustmentsApi(rows)}
      onSuccess={() => qc.invalidateQueries({ queryKey: ["payroll"] })}
    />
  );
}
