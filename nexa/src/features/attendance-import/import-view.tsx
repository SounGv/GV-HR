"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GenericImportCenter } from "@/components/shared/generic-import-center";
import { importAttendanceApi } from "./api";

const HEADER_ALIASES: Record<string, string> = {
  รหัสพนักงาน: "employeeCode", รหัส: "employeeCode", employeecode: "employeeCode", code: "employeeCode",
  วันที่: "date", date: "date",
  เวลาเข้า: "clockIn", clockin: "clockIn",
  เวลาออก: "clockOut", clockout: "clockOut",
};

const COLUMN_LABEL: Record<string, string> = {
  employeeCode: "รหัส", date: "วันที่ (YYYY-MM-DD)", clockIn: "เวลาเข้า (HH:MM)", clockOut: "เวลาออก (HH:MM)",
};

const COLUMNS = ["employeeCode", "date", "clockIn", "clockOut"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validateRow(data: Record<string, string>, seen: Set<string>): string | null {
  if (!data.employeeCode) return "ไม่มีรหัสพนักงาน";
  if (!data.date || !DATE_RE.test(data.date)) return "วันที่ต้องเป็น YYYY-MM-DD";
  if (!data.clockIn || !TIME_RE.test(data.clockIn)) return "เวลาเข้าต้องเป็น HH:MM";
  if (data.clockOut && !TIME_RE.test(data.clockOut)) return "เวลาออกต้องเป็น HH:MM";
  const key = `${data.employeeCode}|${data.date}`;
  if (seen.has(key)) return "ซ้ำในไฟล์ (พนักงาน+วันที่)";
  seen.add(key);
  return null;
}

export function AttendanceImportView() {
  const qc = useQueryClient();
  return (
    <GenericImportCenter
      description="คอลัมน์: รหัสพนักงาน, วันที่ (YYYY-MM-DD), เวลาเข้า (HH:MM), เวลาออก (HH:MM, ไม่บังคับ) — เติมเฉพาะวันที่ยังไม่มีข้อมูลลงเวลา ไม่เขียนทับของเดิม"
      columns={COLUMNS}
      columnLabels={COLUMN_LABEL}
      headerAliases={HEADER_ALIASES}
      requiredColumns={["employeeCode", "date", "clockIn"]}
      validateRow={validateRow}
      templateHeaders="รหัสพนักงาน,วันที่,เวลาเข้า,เวลาออก"
      templateSample="2001,2026-08-01,09:00,18:00"
      templateFilename="attendance-import-template.csv"
      onImport={(rows) => importAttendanceApi(rows)}
      onSuccess={() => qc.invalidateQueries({ queryKey: ["attendance"] })}
    />
  );
}
