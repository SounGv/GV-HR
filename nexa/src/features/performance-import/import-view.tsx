"use client";

import { useQueryClient } from "@tanstack/react-query";
import { GenericImportCenter } from "@/components/shared/generic-import-center";
import { COMPETENCIES } from "@/features/performance/calc";
import { normHeader } from "@/lib/csv-import";
import { importPerformanceReviewsApi } from "./api";

const HEADER_ALIASES: Record<string, string> = {
  รหัสพนักงาน: "employeeCode", รหัส: "employeeCode", employeecode: "employeeCode", code: "employeeCode",
  รอบ: "cycle", cycle: "cycle",
  จุดแข็ง: "strengths", strengths: "strengths",
  สิ่งที่ควรพัฒนา: "improvements", improvements: "improvements",
  สรุป: "summary", summary: "summary",
  ...Object.fromEntries(COMPETENCIES.map((c) => [normHeader(c), c])),
};

const COLUMN_LABEL: Record<string, string> = {
  employeeCode: "รหัส", cycle: "รอบ", strengths: "จุดแข็ง", improvements: "สิ่งที่ควรพัฒนา", summary: "สรุป",
  ...Object.fromEntries(COMPETENCIES.map((c) => [c, c])),
};

const COLUMNS = ["employeeCode", "cycle", ...COMPETENCIES, "strengths", "improvements", "summary"];

function validateRow(data: Record<string, string>, seen: Set<string>): string | null {
  if (!data.employeeCode) return "ไม่มีรหัสพนักงาน";
  if (!data.cycle) return "ไม่มีรอบ";
  for (const c of COMPETENCIES) {
    const v = Number(data[c]);
    if (!data[c] || Number.isNaN(v) || v < 1 || v > 5) return `คะแนน "${c}" ต้องเป็นตัวเลข 1-5`;
  }
  const key = `${data.employeeCode}|${data.cycle}`;
  if (seen.has(key)) return "ซ้ำในไฟล์ (พนักงาน+รอบ)";
  seen.add(key);
  return null;
}

export function PerformanceImportView() {
  const qc = useQueryClient();
  return (
    <GenericImportCenter
      description={`คอลัมน์: รหัสพนักงาน, รอบ, ${COMPETENCIES.join(", ")} (คะแนน 1-5 แต่ละหัวข้อ), จุดแข็ง, สิ่งที่ควรพัฒนา, สรุป — นำเข้าซ้ำจะอัปเดตรอบเดิม (พนักงาน+รอบเดียวกัน)`}
      columns={COLUMNS}
      columnLabels={COLUMN_LABEL}
      headerAliases={HEADER_ALIASES}
      requiredColumns={["employeeCode", "cycle", ...COMPETENCIES]}
      validateRow={validateRow}
      templateHeaders={`รหัสพนักงาน,รอบ,${COMPETENCIES.join(",")},จุดแข็ง,สิ่งที่ควรพัฒนา,สรุป`}
      templateSample={`2001,H1/2569,${COMPETENCIES.map(() => "4").join(",")},ทำงานเป็นทีมดี,ควรพัฒนาการสื่อสาร,ผลงานดีโดยรวม`}
      templateFilename="performance-import-template.csv"
      onImport={(rows) => importPerformanceReviewsApi(rows)}
      onSuccess={() => qc.invalidateQueries({ queryKey: ["performance"] })}
    />
  );
}
