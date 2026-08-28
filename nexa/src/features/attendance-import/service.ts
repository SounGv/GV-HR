import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { lateOrPresent } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { estimateAmount, DEFAULT_MULTIPLIER } from "@/features/overtime/calc";
import type { AccessClaims } from "@/lib/auth/jwt";
import { attendanceImportRowSchema, type AttendanceImportRow } from "./schema";
import type { ImportSummary } from "@/features/employee-import/schema";

type Meta = { ip?: string; userAgent?: string };

/** Below this, a clock-out a few minutes past shift end is just clock-skew
 * noise, not real overtime worth an approval record. */
const MIN_OT_MINUTES = 15;

/** Bangkok (UTC+7, no DST) local date+time → the correct UTC instant. */
function bangkokToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm));
}

/** UTC midnight of the given Bangkok calendar date — matches how `workDate` is stored elsewhere. */
function workDateOf(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Backfills historical attendance from a legacy system/spreadsheet. Only
 * fills in days with NO existing record — an import must never silently
 * overwrite a real punch, so any date that already has a record is skipped
 * with a warning instead (surfaced to HR, not hidden).
 */
export async function importAttendance(
  companyId: string,
  session: AccessClaims,
  rawRows: Record<string, unknown>[],
  meta?: Meta,
): Promise<ImportSummary> {
  const errors: ImportSummary["errors"] = [];
  const warnings: string[] = [];

  const parsedRows: (AttendanceImportRow & { rowIndex: number })[] = [];
  rawRows.forEach((raw, i) => {
    const parsed = attendanceImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 1, code: String(raw.employeeCode ?? "-"), message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
      return;
    }
    parsedRows.push({ ...parsed.data, rowIndex: i + 1 });
  });

  const codes = [...new Set(parsedRows.map((r) => r.employeeCode))];
  const employees = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: codes }, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      branchId: true,
      compensationType: true,
      baseSalary: true,
      dailyRate: true,
      hourlyRate: true,
    },
  });
  const empByCode = new Map(employees.map((e) => [e.employeeCode, e]));

  // Batched, not per-row — the pooled DB connection (connection_limit=1)
  // can't afford one shift lookup per imported row. Date strings are
  // "YYYY-MM-DD" (attendanceImportRowSchema), so plain string min/max works.
  let shiftMap = new Map<string, { startMin: number; endMin: number }>();
  if (parsedRows.length) {
    const minDate = parsedRows.reduce((min, r) => (r.date < min ? r.date : min), parsedRows[0].date);
    const maxDate = parsedRows.reduce((max, r) => (r.date > max ? r.date : max), parsedRows[0].date);
    const rangeEnd = workDateOf(maxDate);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    shiftMap = await resolveShiftMinutesBatch(companyId, workDateOf(minDate), rangeEnd);
  }

  let created = 0;
  let otCreated = 0;
  for (const r of parsedRows) {
    const employee = empByCode.get(r.employeeCode);
    if (!employee) {
      errors.push({ row: r.rowIndex, code: r.employeeCode, message: "ไม่พบรหัสพนักงานนี้ในระบบ" });
      continue;
    }
    const workDate = workDateOf(r.date);

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      select: { id: true },
    });
    if (existing) {
      warnings.push(`${r.employeeCode} (${r.date}): มีข้อมูลลงเวลาอยู่แล้ว ข้ามแถวนี้`);
      continue;
    }

    const clockInAt = bangkokToUtc(r.date, r.clockIn);
    const clockOutAt = r.clockOut ? bangkokToUtc(r.date, r.clockOut) : null;
    const [hh, mm] = r.clockIn.split(":").map(Number);
    const shift = shiftMinutesFromBatch(shiftMap, employee.id, workDate);
    const status = lateOrPresent(hh * 60 + mm, shift.startMin);

    await prisma.attendanceRecord.create({
      data: {
        companyId,
        employeeId: employee.id,
        workDate,
        clockInAt,
        clockOutAt,
        workMode: "ONSITE",
        clockInBranchId: employee.branchId,
        status,
        note: "นำเข้าจากไฟล์โดยฝ่ายบุคคล",
        createdById: session.sub,
        updatedById: session.sub,
      },
    });
    created++;

    // An imported punch that clocks out past the employee's scheduled shift
    // end is real overtime that a bare clock-in/out import would otherwise
    // never surface — there's no OT request behind it (the system wasn't
    // live yet), so it must never reach payroll. Auto-approve one from the
    // excess minutes instead: HR uploading this file is already attesting
    // these hours happened, the same trust an import already extends to the
    // attendance records themselves.
    if (r.clockOut) {
      const [outH, outM] = r.clockOut.split(":").map(Number);
      const excessMinutes = outH * 60 + outM - shift.endMin;
      if (excessMinutes >= MIN_OT_MINUTES) {
        const hours = Math.round((excessMinutes / 60) * 100) / 100;
        const estimated = estimateAmount(
          {
            compensationType: employee.compensationType,
            baseSalary: employee.baseSalary ? Number(employee.baseSalary) : null,
            dailyRate: employee.dailyRate ? Number(employee.dailyRate) : null,
            hourlyRate: employee.hourlyRate ? Number(employee.hourlyRate) : null,
          },
          hours,
          DEFAULT_MULTIPLIER,
        );
        const shiftEndLabel = `${String(Math.floor(shift.endMin / 60)).padStart(2, "0")}:${String(shift.endMin % 60).padStart(2, "0")}`;
        await prisma.overtimeRequest.create({
          data: {
            companyId,
            employeeId: employee.id,
            date: workDate,
            startTime: shiftEndLabel,
            endTime: r.clockOut,
            hours,
            multiplier: DEFAULT_MULTIPLIER,
            estimatedAmount: estimated,
            reason: "สร้างอัตโนมัติจากการนำเข้าไฟล์ลงเวลา (เวลาออกเกินกะ)",
            status: "APPROVED",
            approverEmployeeId: session.employeeId ?? null,
            approverUserId: session.sub,
            decidedAt: new Date(),
            decisionNote: "อนุมัติอัตโนมัติจากการนำเข้าไฟล์ลงเวลาโดยฝ่ายบุคคล",
            createdById: session.sub,
            updatedById: session.sub,
          },
        });
        otCreated++;
      }
    }
  }

  if (otCreated > 0) {
    warnings.push(`สร้างคำขอ OT อัตโนมัติ ${otCreated} รายการ จากเวลาที่ลงออกเกินกะงาน (อนุมัติให้อัตโนมัติแล้ว)`);
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.import",
    entity: "AttendanceRecord",
    after: { created, otCreated, errors: errors.length, warnings: warnings.length },
    ...meta,
  });

  return { created, updated: 0, total: parsedRows.length, errors, warnings };
}
