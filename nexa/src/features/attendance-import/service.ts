import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { lateOrPresent } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { estimateAmount, DEFAULT_MULTIPLIER, MIN_OT_MINUTES } from "@/features/overtime/calc";
import type { AccessClaims } from "@/lib/auth/jwt";
import { attendanceImportRowSchema, type AttendanceImportRow } from "./schema";
import type { ImportSummary } from "@/features/employee-import/schema";
import { refreshAttendanceWatch } from "@/features/attendance-status/watch-cache";

type Meta = { ip?: string; userAgent?: string };

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

  // Written before the rows are saved: if the function is cut off part-way, this still shows who started which import.
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.import.start",
    entity: "AttendanceRecord",
    after: { rows: rawRows.length, valid: parsedRows.length },
    ...meta,
  });

  const codes = [...new Set(parsedRows.map((r) => r.employeeCode))];
  const employees = await prisma.employee.findMany({
    where: { companyId, employeeCode: { in: codes }, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      branchId: true,
      employmentType: true,
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
  let otSkipped = 0;
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
    // The import format has one date shared by clock-in and clock-out, so it
    // can't represent a real overnight shift (e.g. 22:00 in / 06:00 out next
    // day) — a clock-out that lands at or before clock-in under that shared
    // date is ambiguous/bad data, not a legitimate case this importer can
    // safely interpret. Importing it anyway would silently create a
    // negative-duration record that then *subtracts* hours from an HOURLY
    // employee's payroll total instead of adding them.
    if (clockOutAt && clockOutAt <= clockInAt) {
      warnings.push(
        `${r.employeeCode} (${r.date}): เวลาออก (${r.clockOut}) ไม่อยู่หลังเวลาเข้า (${r.clockIn}) — ข้ามแถวนี้ (กะข้ามคืนต้องแยกลงเป็น 2 แถว)`,
      );
      continue;
    }
    const [hh, mm] = r.clockIn.split(":").map(Number);
    const shift = shiftMinutesFromBatch(shiftMap, employee.id, workDate, employee.employmentType);
    const status = lateOrPresent(hh * 60 + mm, shift.startMin);

    // An imported punch that clocks out past the employee's scheduled shift
    // end may be real overtime, but staying late is not OT until someone asks
    // for it and someone approves (HR rule of 20 Oct 2569; Favpo works the same
    // way: staff record OT, a manager approves). So the import only raises a
    // PENDING request from the excess minutes; an approver decides, and only an
    // approved one reaches payroll.
    // Saturday is a company-wide half day — time worked past the (already
    // shortened) shift end doesn't count as OT, per company policy.
    let otData: Prisma.OvertimeRequestUncheckedCreateInput | null = null;
    if (r.clockOut && workDate.getUTCDay() !== 6) {
      const [outH, outM] = r.clockOut.split(":").map(Number);
      const excessMinutes = outH * 60 + outM - shift.endMin;
      // Skip when that day already has a request in any status: one the person asked for would be paid twice,
      // and one that was rejected or cancelled is a decision this import must not undo.
      const existingOt =
        excessMinutes >= MIN_OT_MINUTES
          ? await prisma.overtimeRequest.count({
              where: { companyId, employeeId: employee.id, date: workDate, deletedAt: null },
            })
          : 0;
      if (existingOt > 0) otSkipped++;
      if (excessMinutes >= MIN_OT_MINUTES && existingOt === 0) {
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
        otData = {
          companyId,
          employeeId: employee.id,
          date: workDate,
          startTime: shiftEndLabel,
          endTime: r.clockOut,
          hours,
          multiplier: DEFAULT_MULTIPLIER,
          estimatedAmount: estimated,
          reason: "สร้างจากการนำเข้าไฟล์ลงเวลา (เวลาออกเกินกะ) รอผู้อนุมัติตัดสิน",
          status: "PENDING",
          createdById: session.sub,
          updatedById: session.sub,
        };
      }
    }

    // The punch and its OT go in together or not at all. A row that lost a race
    // with a real scan (same employee and date) is skipped with a warning, not a 500.
    try {
      await prisma.$transaction([
        prisma.attendanceRecord.create({
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
        }),
        ...(otData ? [prisma.overtimeRequest.create({ data: otData })] : []),
      ]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        warnings.push(`${r.employeeCode} (${r.date}): มีข้อมูลลงเวลาอยู่แล้ว ข้ามแถวนี้`);
        continue;
      }
      throw err;
    }
    created++;
    if (otData) otCreated++;
  }

  if (otCreated > 0) {
    warnings.push(`สร้างคำขอ OT ${otCreated} รายการ จากเวลาที่ลงออกเกินกะงาน สถานะรออนุมัติ ยังไม่ถูกนำไปคิดเงิน จนกว่าผู้อนุมัติจะอนุมัติ`);
  }
  if (otSkipped > 0) {
    warnings.push(`ไม่ได้สร้างคำขอ OT ${otSkipped} รายการ เพราะวันนั้นมีคำขอ OT อยู่แล้ว (รออนุมัติ อนุมัติ ไม่อนุมัติ หรือยกเลิก)`);
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.import",
    entity: "AttendanceRecord",
    after: { created, otCreated, errors: errors.length, warnings: warnings.length },
    ...meta,
  });

  if (created > 0) refreshAttendanceWatch(companyId);
  return { created, updated: 0, total: parsedRows.length, errors, warnings };
}
