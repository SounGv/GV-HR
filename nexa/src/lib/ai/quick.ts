import type { Prisma } from "@prisma/client";
import { can, canAny } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { loadTodayAttendance } from "@/features/attendance-status/service";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";
import { clampTop, dayText as leaveDayText, rankLeave } from "@/features/ai/leave-ranking";
import { displayName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { executeReadTool, findInScope } from "@/lib/ai/read-tools";
import { getReport } from "@/features/report/service";
import { prepareProposal } from "@/lib/ai/proposals";
import type { ProposalCard } from "@/features/ai/proposal";
import { LOCAL_SOURCE_LINE, quickToMarkdown, QUICK_MAX_ROWS, rowsNote, THAI_MONTHS, type QuickAction } from "@/features/ai/quick-actions";
import { bangkokParts } from "@/lib/datetime";

/**
 * The quick actions, answered from our own data with no AI. They reuse the read tools and the confirmation cards,
 * so permissions, scope and the "press confirm" rule are exactly the ones the AI path uses.
 */

export interface QuickInput {
  action: QuickAction;
  count?: number;
  month?: number;
  /** An exact range (ISO days), wins over `month`. */
  from?: string;
  to?: string;
  name?: string;
  title?: string;
  body?: string;
  target?: string;
}

export type QuickResult =
  | { ok: true; markdown: string; proposals: ProposalCard[] }
  | { ok: false; message: string; needs?: "name" };

/** Every answer, even a one-liner, ends with the line that says it came from our own data with no AI. */
const text = (markdown: string): QuickResult => ({
  ok: true,
  markdown: markdown.includes(LOCAL_SOURCE_LINE) ? markdown : quickToMarkdown({ text: markdown }),
  proposals: [],
});
const refused = (message: string): QuickResult => ({ ok: false, message });

/** A read tool's reply is JSON, or a plain Thai sentence when it refuses or finds nothing. */
function parse<T>(raw: string | null): { data: T } | { message: string } {
  if (raw === null) return { message: "ทำรายการนี้ไม่ได้" };
  try {
    return { data: JSON.parse(raw) as T };
  } catch {
    return { message: raw };
  }
}

const dayText = (iso: string | null | undefined) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "-");

export async function runQuickAction(session: AccessClaims, scopeWhere: Prisma.EmployeeWhereInput | undefined, input: QuickInput): Promise<QuickResult> {
  switch (input.action) {
    case "late_today":
    case "absent_today": {
      if (!canAny(session.perms, ["dashboard:read", "report:read", "attendance:read"])) return refused("ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ดูข้อมูลการเข้างาน");
      const data = await loadTodayAttendance(session.companyId, session);
      const late = input.action === "late_today";
      if (!data.isWorkingDay) return text(`วันนี้ไม่ใช่วันทำงาน (${data.nonWorkingReason ?? "วันหยุด"}) จึงไม่นับ${late ? "สาย" : "ขาด"}`);
      const all = data.people.filter((p) => p.status === (late ? "LATE" : "ABSENT"));
      if (all.length === 0) return text(`ข้อมูล ณ ${data.asOf} น. ยังไม่มีคน${late ? "มาสาย" : "ขาดงาน"}วันนี้`);
      const sorted = [...all].sort((a, b) => (late ? (b.lateMinutes ?? 0) - (a.lateMinutes ?? 0) : a.shiftStart.localeCompare(b.shiftStart) || a.name.localeCompare(b.name, "th")));
      const shown = sorted.slice(0, QUICK_MAX_ROWS);
      return text(
        quickToMarkdown({
          text: `ข้อมูล ณ ${data.asOf} น. วันนี้${late ? "มาสาย" : "ยังไม่สแกนและไม่มีใบลา"} ${all.length} คน`,
          table: late
            ? { head: ["ชื่อ", "แผนก", "สาย (นาที)"], rows: shown.map((p) => [p.name, p.department, String(p.lateMinutes ?? 0)]) }
            : { head: ["ชื่อ", "แผนก", "เริ่มงาน"], rows: shown.map((p) => [p.name, p.department, p.shiftStart]) },
          note: rowsNote(shown.length, all.length, "คน"),
        }),
      );
    }

    case "pending_approvals": {
      const r = parse<{ leave?: { total: number; items: Record<string, unknown>[] }; overtime?: { total: number; items: Record<string, unknown>[] }; correction?: { total: number; items: Record<string, unknown>[] } }>(
        await executeReadTool(session, "list_pending_approvals", {}, scopeWhere),
      );
      if ("message" in r) return refused(r.message);
      const rows: string[][] = [];
      const add = (label: string, part: { total: number; items: Record<string, unknown>[] } | undefined, when: (i: Record<string, unknown>) => string) => {
        for (const i of part?.items ?? []) rows.push([label, String(i.employee ?? "-"), when(i), dayText(String(i.requestedAt ?? ""))]);
      };
      add("ลา", r.data.leave, (i) => `${String(i.type ?? "")} ${dayText(i.from as string)}${i.to && i.to !== i.from ? "-" + dayText(i.to as string) : ""} (${String(i.days ?? "")} วัน)`);
      add("OT", r.data.overtime, (i) => `${dayText(i.date as string)} ${String(i.time ?? "")} (${String(i.hours ?? "")} ชม.)`);
      add("ขอแก้เวลา", r.data.correction, (i) => `วันที่ ${dayText(i.workDate as string)}`);
      const total = (r.data.leave?.total ?? 0) + (r.data.overtime?.total ?? 0) + (r.data.correction?.total ?? 0);
      if (total === 0) return text("ตอนนี้ไม่มีคำขอที่รออนุมัติ");
      const shown = rows.slice(0, QUICK_MAX_ROWS);
      return text(
        quickToMarkdown({
          text: `มีคำขอรออนุมัติ ${total} รายการ (ลา ${r.data.leave?.total ?? 0}, OT ${r.data.overtime?.total ?? 0}, ขอแก้เวลา ${r.data.correction?.total ?? 0}) อนุมัติได้ที่หน้าคำขอ`,
          table: { head: ["ประเภท", "ผู้ขอ", "รายละเอียด", "ขอเมื่อ"], rows: shown },
          note: rowsNote(shown.length, total, "รายการ"),
        }),
      );
    }

    case "leave_quota": {
      const name = input.name?.trim();
      if (!name) return { ok: false, message: "ต้องการดูโควตาของใคร พิมพ์ชื่อหรือรหัสพนักงาน", needs: "name" };
      const r = parse<{ employee: string; year: number; balances: { type: string; totalDays: number; usedDays: number; pendingDays: number; remainingDays: number }[] }>(
        await executeReadTool(session, "get_leave_balance", { employee: name }, scopeWhere),
      );
      if ("message" in r) return refused(r.message);
      return text(
        quickToMarkdown({
          text: `โควตาวันลาปี ${r.data.year + 543} ของ ${r.data.employee} (คงเหลือหักวันที่รออนุมัติแล้ว)`,
          table: {
            head: ["ประเภท", "โควตา", "ใช้ไป", "รออนุมัติ", "คงเหลือ"],
            rows: r.data.balances.map((b) => [b.type, `${b.totalDays} วัน`, `${b.usedDays} วัน`, `${b.pendingDays} วัน`, `${b.remainingDays} วัน`]),
          },
        }),
      );
    }

    case "scan_daily":
    case "scan_month": {
      if (!can(session.perms, "report:read")) return refused("ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ดูรายงาน");
      // The range typed, else the month asked for (else this one: a month later than this one means last year's); the
      // button for staff paid by the day with no date means this month so far.
      const now = bangkokParts();
      const month = input.month ?? now.month;
      const year = month > now.month ? now.year - 1 : now.year;
      const monthFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthTo = `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
      const thisMonthSoFar = input.action === "scan_daily" && !input.month && !input.from;
      const from = input.from && input.to ? input.from : monthFrom;
      const to = input.from && input.to ? input.to : thisMonthSoFar ? `${monthFrom.slice(0, 8)}${String(now.day).padStart(2, "0")}` : monthTo;
      const thaiDay = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}/${Number(iso.slice(0, 4)) + 543}`;
      const monthText = input.from && input.to ? `${thaiDay(from)} ถึง ${thaiDay(to)}` : thisMonthSoFar ? `${THAI_MONTHS[month - 1]} ${year + 543} (ถึงวันนี้)` : `${THAI_MONTHS[month - 1]} ${year + 543}`;
      const periodText = input.from && input.to ? `ช่วง ${monthText}` : `เดือน${monthText}`;
      if (input.action === "scan_daily") {
        // The report page filters by employment type (พนักงานรายวัน), shows the net hours and full or part day, and exports Excel.
        return text(
          `เวลาเข้า-ออกของพนักงานรายวัน ${periodText} มีหลายแถว เปิดดูและส่งออก Excel ได้ที่หน้ารายงาน ตั้งตัวกรองประเภทการจ้างเป็น "พนักงานรายวัน" ให้แล้ว (คนที่ตั้งเป็นพนักงานประจำแต่รับเงินรายวันไม่อยู่ในตัวกรองนี้)\n\n[เปิดรายงานเวลาเข้า-ออกพนักงานรายวัน ${periodText}](/reports?view=attendance_daily&from=${from}&to=${to}&employmentType=DAILY_WORKER)\n\nคอลัมน์ "ชั่วโมงสุทธิ (รายวัน)" และ "ครบวัน/ไม่เต็มวัน" ช่วยดูคนที่ทำไม่เต็มวัน`,
        );
      }
      const name = input.name?.trim();
      if (!name) {
        // Everyone's day-by-day scans run to hundreds of rows, too many for a chat: the report page shows and exports them.
        return text(
          `รายงานสแกนเข้า-ออกรายวันของพนักงานทุกคน ${periodText} มีหลายร้อยแถว เปิดดูและส่งออก Excel ได้ที่หน้ารายงาน\n\n[เปิดรายงานรายละเอียดการลงเวลา ${periodText}](/reports?view=attendance_daily&from=${from}&to=${to})\n\nถ้าอยากดูทีละคน พิมพ์ "สแกนเข้าออกของ ชื่อ" ได้เลย`,
        );
      }
      const found = await findInScope(session.companyId, name, scopeWhere);
      if (found.length === 0) return refused("ไม่พบพนักงานที่ตรงกับคำค้นในขอบเขตของคุณ");
      if (found.length > 1) return refused(`พบหลายคน ระบุให้ชัดขึ้น: ${found.map((e) => `${displayName(e)} (${e.employeeCode})`).join(", ")}`);
      const person = found[0];
      // The same report as the Reports page, one person, no AI. Days without a clock-in have no row.
      const report = await getReport(session.companyId, { type: "attendance_daily", from, to, employeeId: [person.id], employeeWhere: scopeWhere, includeNames: false });
      const days = [...report.rows].reverse();
      const who = displayName(person);
      if (days.length === 0) return text(`${who} ไม่มีการสแกนเข้า-ออก${periodText}`);
      const lateDays = days.filter((r) => typeof r.lateMinutes === "number").length;
      return text(
        quickToMarkdown({
          text: `การสแกนเข้า-ออก${periodText} ของ ${who} ${days.length} วัน มาสาย ${lateDays} วัน`,
          table: { head: ["วันที่", "เข้า", "ออก", "สาย (นาที)", "สถานะ"], rows: days.map((r) => [String(r.date), String(r.clockIn), String(r.clockOut), String(r.lateMinutes), String(r.status)]) },
          note: "แสดงเฉพาะวันที่มีบันทึก วันที่ไม่แสดงคือวันหยุดหรือไม่มีการสแกน ดูวันขาดได้ที่รายงาน สรุปการลงเวลา (รายเดือน)",
        }),
      );
    }

    case "shifts_week": {
      const r = parse<{ from: string; to: string; total: number; assignments: { date: string; employee: string; shift: string; time: string }[] }>(
        await executeReadTool(session, "get_shift_schedule", {}, scopeWhere),
      );
      if ("message" in r) return refused(r.message);
      if (r.data.total === 0) return text(`ยังไม่มีการตั้งกะระหว่าง ${dayText(r.data.from)} ถึง ${dayText(r.data.to)}`);
      const shown = r.data.assignments.slice(0, QUICK_MAX_ROWS);
      return text(
        quickToMarkdown({
          text: `ตารางกะ ${dayText(r.data.from)} ถึง ${dayText(r.data.to)} รวม ${r.data.total} รายการ`,
          table: { head: ["วันที่", "ชื่อ", "กะ", "เวลา"], rows: shown.map((a) => [dayText(a.date), a.employee, a.shift, a.time]) },
          note: rowsNote(shown.length, r.data.total, "รายการ"),
        }),
      );
    }

    case "eval_progress": {
      const r = parse<{ name: string; closes: string | null; participants: number; peopleWaiting?: number; evaluationsSubmitted: number; evaluationsTotal: number; percentDone: number; resultsFinalized: number }[]>(
        await executeReadTool(session, "get_evaluation_progress", {}, scopeWhere),
      );
      // "No round is open" is an answer, not a refusal.
      if ("message" in r) return /ไม่มีรอบประเมิน|ไม่พบรอบประเมิน/.test(r.message) ? text("ตอนนี้ไม่มีรอบประเมินที่เปิดอยู่") : refused(r.message);
      if (r.data.length === 0) return text("ตอนนี้ไม่มีรอบประเมินที่เปิดอยู่");
      return text(
        quickToMarkdown({
          text: "ความคืบหน้ารอบประเมินที่เปิดอยู่",
          table: {
            head: ["รอบ", "ปิด", "ส่งแล้ว", "คนที่ยังรอประเมิน"],
            rows: r.data.map((c) => [
              c.name,
              dayText(c.closes),
              `${c.evaluationsSubmitted}/${c.evaluationsTotal} (${c.percentDone}%)`,
              c.peopleWaiting !== undefined ? `${c.peopleWaiting} จาก ${c.participants} คน` : `${c.participants - c.resultsFinalized} จาก ${c.participants} คน`,
            ]),
          },
        }),
      );
    }

    case "leave_ranking": {
      if (!canAny(session.perms, ["leave:approve", "leave:manage", "report:read"])) return refused("ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ดูสถิติการลา");
      // The calendar year in Bangkok; only approved leave taken by the day counts, and a manager sees only their own scope.
      // shortcut: a request is counted whole in the year it starts (one spanning New Year is not split); fine for a top-N list,
      // split by day if HR ever needs exact year totals.
      const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
      const rows = await prisma.leaveRequest.findMany({
        where: {
          companyId: session.companyId,
          status: "APPROVED",
          deletedAt: null,
          unit: "DAY",
          startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
          employee: { deletedAt: null, ...(scopeWhere ?? {}) },
        },
        select: { employeeId: true, type: true, days: true, employee: { select: { firstName: true, lastName: true, nickname: true, department: { select: { name: true } } } } },
        take: 20000,
      });
      const ranking = rankLeave(
        rows.map((r) => ({ employeeId: r.employeeId, name: displayName(r.employee), department: r.employee.department?.name ?? "ไม่ระบุแผนก", typeLabel: LEAVE_TYPE_LABEL[r.type] ?? r.type, days: r.days })),
        clampTop(input.count),
      );
      if (ranking.people === 0) return text(`ปี ${year + 543} ยังไม่มีการลาที่อนุมัติแล้ว`);
      const tie = ranking.tiedBeyond > 0 ? ` อีก ${ranking.tiedBeyond} คนลาเท่าอันดับสุดท้ายไม่ได้แสดง` : "";
      return text(
        quickToMarkdown({
          text: `ปี ${year + 543} คนที่ลาเยอะสุด ${ranking.lines.length} อันดับ จากทั้งหมด ${ranking.people} คนที่ลา (นับวันลาที่อนุมัติแล้ว)`,
          table: { head: ["อันดับ", "ชื่อ", "แผนก", "รวม (วัน)", "แยกประเภท"], rows: ranking.lines.map((l, i) => [String(i + 1), l.name, l.department, leaveDayText(l.totalDays), l.breakdown]) },
          note: `ไม่นับการลารายชั่วโมง${tie}`,
        }),
      );
    }

    case "announce":
    case "notify": {
      const announce = input.action === "announce";
      if (!announce && !input.target?.trim()) return refused("ระบุผู้รับก่อน พิมพ์ชื่อพนักงาน หรือเลือกส่งถึงทุกคน");
      const { card, message } = await prepareProposal(
        session,
        announce ? "create_announcement" : "send_notification",
        { title: input.title ?? "", body: input.body ?? "", ...(announce ? {} : { target: input.target!.trim() }) },
        scopeWhere,
      );
      if (!card) return refused(message);
      return { ok: true, markdown: "เตรียมการ์ดให้แล้ว ตรวจข้อความและกดยืนยันเมื่อพร้อม ตอนนี้ยังไม่ได้ส่งหรือเผยแพร่", proposals: [card] };
    }
  }
}
