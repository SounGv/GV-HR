"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GenericImportCenter } from "@/components/shared/generic-import-center";
import { importKpiGoalsApi } from "./api";

const HEADER_ALIASES: Record<string, string> = {
  รหัสพนักงาน: "employeeCode", รหัส: "employeeCode", employeecode: "employeeCode", code: "employeeCode",
  ชื่อเป้าหมาย: "title", title: "title",
  รอบ: "cycle", cycle: "cycle",
  หน่วย: "unit", unit: "unit",
  เป้าหมาย: "targetValue", target: "targetValue", targetvalue: "targetValue",
  ผลปัจจุบัน: "currentValue", current: "currentValue", currentvalue: "currentValue",
  น้ำหนัก: "weight", weight: "weight",
  วันครบกำหนด: "dueDate", duedate: "dueDate",
};

const COLUMN_LABEL: Record<string, string> = {
  employeeCode: "รหัส", title: "ชื่อเป้าหมาย", cycle: "รอบ", unit: "หน่วย",
  targetValue: "เป้าหมาย", currentValue: "ผลปัจจุบัน", weight: "น้ำหนัก (1-5)", dueDate: "วันครบกำหนด",
};

const COLUMNS = ["employeeCode", "title", "cycle", "unit", "targetValue", "currentValue", "weight", "dueDate"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRow(data: Record<string, string>): string | null {
  if (!data.employeeCode) return "ไม่มีรหัสพนักงาน";
  if (!data.title) return "ไม่มีชื่อเป้าหมาย";
  if (!data.cycle) return "ไม่มีรอบ";
  if (!data.targetValue || Number.isNaN(Number(data.targetValue))) return "เป้าหมายต้องเป็นตัวเลข";
  if (data.weight && (Number(data.weight) < 1 || Number(data.weight) > 5)) return "น้ำหนักต้องอยู่ระหว่าง 1-5";
  if (data.dueDate && !DATE_RE.test(data.dueDate)) return "วันครบกำหนดต้องเป็น YYYY-MM-DD";
  return null;
}

export function KpiImportView() {
  const qc = useQueryClient();
  return (
    <GenericImportCenter
      description="คอลัมน์: รหัสพนักงาน, ชื่อเป้าหมาย, รอบ, หน่วย, เป้าหมาย, ผลปัจจุบัน, น้ำหนัก (1-5), วันครบกำหนด — นำเข้าซ้ำจะอัปเดตเป้าหมายเดิม (พนักงาน+ชื่อ+รอบเดียวกัน)"
      columns={COLUMNS}
      columnLabels={COLUMN_LABEL}
      headerAliases={HEADER_ALIASES}
      requiredColumns={["employeeCode", "title", "cycle", "targetValue"]}
      validateRow={validateRow}
      templateHeaders="รหัสพนักงาน,ชื่อเป้าหมาย,รอบ,หน่วย,เป้าหมาย,ผลปัจจุบัน,น้ำหนัก,วันครบกำหนด"
      templateSample="2001,ยอดขายไตรมาส,H1/2569,บาท,500000,0,3,2026-06-30"
      templateFilename="kpi-import-template.csv"
      onImport={(rows) => importKpiGoalsApi(rows)}
      onSuccess={() => qc.invalidateQueries({ queryKey: ["kpi"] })}
    />
  );
}
