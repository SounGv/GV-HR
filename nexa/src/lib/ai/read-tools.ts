import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, canAny } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { displayName } from "@/lib/format";
import { employeeNameFilter } from "@/lib/ai/scope";
import { getBalancesFor } from "@/features/leave/service";
import { listLeave } from "@/features/leave/service";
import { listOvertime } from "@/features/overtime/service";
import { listAttendanceCorrections } from "@/features/attendance-correction/service";
import { listAssignments } from "@/features/shift/service";
import { balanceLine, bangkokToday, clampRange, LEAVE_LABEL, percentDone } from "@/features/ai/read-summary";
import type { NexaTool } from "@/lib/ai/tools";

/**
 * Phase 1 of "น้องวีบอททำงานได้ทุกอย่าง": tools that only READ across modules
 * (leave balance, requests waiting for approval, shifts, evaluation progress).
 * Each one applies the same permission as the page it mirrors and the person's
 * AI scope (`scopeWhere`), and none of them writes anything.
 */

const NO_PERM = (perm: string) => `ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ ${perm} จึงจะใช้เครื่องมือนี้ได้`;

export const READ_TOOL_NAMES = ["get_leave_balance", "list_pending_approvals", "get_shift_schedule", "get_evaluation_progress"] as const;

export const READ_TOOLS: NexaTool[] = [
  {
    name: "get_leave_balance",
    description:
      "Check leave quota (โควตาวันลา) for one employee: per leave type the total days, days used, days waiting for approval and days remaining for the year. Omit `employee` to check the person asking. Use for 'เช็คโควตา', 'ลาพักร้อนเหลือกี่วัน'. Looking up someone else needs approver rights and the person must be inside the asker's scope.",
    input_schema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "employee name, nickname or code; omit for the asker themselves" },
        year: { type: "number", description: "calendar year (Gregorian, e.g. 2026); omit for this year" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_pending_approvals",
    description:
      "List requests waiting for the asker's approval: leave (ลา), overtime (OT) and attendance time corrections (ขอแก้เวลา). HR sees all; a manager sees their own team. Read-only: this does not approve anything (use approve_requests with the ids for that). Use for 'มีอะไรรออนุมัติบ้าง'.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: ["all", "leave", "overtime", "correction"], description: "default all" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_shift_schedule",
    description:
      "Show who works which shift (กะงาน) on which dates, plus the shift templates. Defaults to today and the next 6 days; at most 31 days. Optional `employee` filters to one person. Only people inside the asker's scope are shown.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        employee: { type: "string", description: "employee name, nickname or code" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_evaluation_progress",
    description:
      "Progress of evaluation rounds (รอบประเมิน), open ones by default: how many evaluations are submitted out of the total, per rater type (self, manager, ...), how many results are finalized, and who still has to submit. Optional `campaign` filters by round name. Only people inside the asker's scope are counted.",
    input_schema: {
      type: "object",
      properties: {
        campaign: { type: "string", description: "round name or part of it" },
        includeClosed: { type: "boolean", description: "also show rounds that have closed (latest first); default only open rounds" },
      },
      additionalProperties: false,
    },
  },
];

const dayOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Finds people by name, nickname or code inside the asker's scope (AND, not spread: scopeWhere may be an OR filter). */
async function findInScope(companyId: string, q: string, scopeWhere?: Prisma.EmployeeWhereInput) {
  return prisma.employee.findMany({
    where: { companyId, deletedAt: null, AND: [scopeWhere ?? {}, employeeNameFilter(q)] },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, nickname: true },
    take: 6,
  });
}

const personText = (e: { firstName: string | null; lastName: string | null; nickname: string | null }) => displayName(e);

/** Runs a read tool. Returns text for the model, or null when `name` is not a read tool. */
export async function executeReadTool(
  session: AccessClaims,
  name: string,
  input: Record<string, unknown>,
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<string | null> {
  const companyId = session.companyId;

  switch (name) {
    case "get_leave_balance": {
      if (!can(session.perms, "leave:read")) return NO_PERM("leave:read");
      const year = typeof input.year === "number" && Number.isInteger(input.year) && input.year >= 2000 && input.year <= 2100 ? input.year : undefined;
      const q = typeof input.employee === "string" ? input.employee.trim() : "";

      let employeeId = session.employeeId;
      let who = "คุณ";
      if (q) {
        if (!canAny(session.perms, ["leave:approve", "leave:manage"])) return NO_PERM("leave:manage");
        const found = await findInScope(companyId, q, scopeWhere);
        if (found.length === 0) return "ไม่พบพนักงานที่ตรงกับคำค้นในขอบเขตของคุณ";
        if (found.length > 1) return `พบหลายคน ให้ถามผู้ใช้ว่าหมายถึงคนไหน: ${found.map((e) => `${personText(e)} (${e.employeeCode})`).join(", ")}`;
        employeeId = found[0].id;
        who = personText(found[0]);
      }
      if (!employeeId) return "บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน เช็คโควตาของตัวเองไม่ได้ ให้ระบุชื่อพนักงานที่ต้องการเช็ค";

      const rows = await getBalancesFor(companyId, employeeId, year);
      return JSON.stringify({
        employee: who,
        year: year ?? new Date().getFullYear(),
        quotaConfiguredByHr: rows.every((r) => r.daysConfigured),
        balances: rows.map((r) => ({
          ...balanceLine(r.type, r.totalDays, r.usedDays, r.pendingDays),
          ...(r.totalHours > 0 || r.usedHours > 0 ? { totalHours: r.totalHours, usedHours: r.usedHours } : {}),
        })),
        note: "remainingDays หักวันที่รออนุมัติแล้ว",
      });
    }

    case "list_pending_approvals": {
      const kind = typeof input.kind === "string" ? input.kind : "all";
      const want = (k: string) => kind === "all" || kind === k;
      const out: Record<string, unknown> = {};
      const denied: string[] = [];
      const LIMIT = 25;

      if (want("leave")) {
        if (!canAny(session.perms, ["leave:approve", "leave:manage"])) denied.push("leave:manage");
        else {
          const rows = await listLeave(companyId, session, { scope: "team", status: "PENDING" });
          out.leave = {
            total: rows.length,
            items: rows.slice(0, LIMIT).map((r) => ({
              id: r.id,
              employee: personText(r.employee),
              type: LEAVE_LABEL[r.type] ?? r.type,
              from: dayOf(r.startDate),
              to: dayOf(r.endDate),
              days: r.days,
              ...(r.unit === "HOUR" ? { hours: r.hours, time: `${r.startTime}-${r.endTime}` } : {}),
              reason: r.reason ?? null,
              requestedAt: dayOf(r.createdAt),
            })),
          };
        }
      }
      if (want("overtime")) {
        if (!canAny(session.perms, ["overtime:approve", "overtime:manage"])) denied.push("overtime:manage");
        else {
          const rows = await listOvertime(companyId, session, { scope: "team", status: "PENDING" });
          out.overtime = {
            total: rows.length,
            items: rows.slice(0, LIMIT).map((r) => ({
              id: r.id,
              employee: personText(r.employee),
              date: dayOf(r.date),
              time: `${r.startTime}-${r.endTime}`,
              hours: r.hours,
              multiplier: r.multiplier,
              reason: r.reason ?? null,
              requestedAt: dayOf(r.createdAt),
            })),
          };
        }
      }
      if (want("correction")) {
        if (!canAny(session.perms, ["attendance:approve", "attendance:manage"])) denied.push("attendance:manage");
        else {
          const rows = await listAttendanceCorrections(companyId, session, { scope: "team", status: "PENDING" });
          out.correction = {
            total: rows.length,
            items: rows.slice(0, LIMIT).map((r) => ({
              id: r.id,
              employee: personText(r.employee),
              workDate: dayOf(r.workDate),
              clockIn: r.requestedClockIn?.toISOString() ?? null,
              clockOut: r.requestedClockOut?.toISOString() ?? null,
              reason: r.reason,
              requestedAt: dayOf(r.createdAt),
            })),
          };
        }
      }
      if (Object.keys(out).length === 0 && denied.length > 0) return NO_PERM(denied[0]);
      if (denied.length > 0) out.notAllowed = denied;
      out.note = `แสดงไม่เกิน ${LIMIT} รายการต่อประเภท (total คือจำนวนทั้งหมด) ถ้าจะอนุมัติลา (kind=leave) หรือขอแก้เวลา (kind=correction) ให้ใช้ approve_requests ด้วย id ในรายการนี้ OT อนุมัติผ่านน้องวีบอทไม่ได้ ต้องทำที่หน้า OT`;
      return JSON.stringify(out);
    }

    case "get_shift_schedule": {
      if (!can(session.perms, "shift:read")) return NO_PERM("shift:read");
      const range = clampRange(input.from, input.to, bangkokToday());
      const q = typeof input.employee === "string" ? input.employee.trim() : "";

      let onlyIds: string[] | null = null;
      if (q) {
        const found = await findInScope(companyId, q, scopeWhere);
        if (found.length === 0) return "ไม่พบพนักงานที่ตรงกับคำค้นในขอบเขตของคุณ";
        onlyIds = found.map((e) => e.id);
      }
      const rows = await listAssignments(companyId, range.from, range.to);
      const ids = [...new Set(rows.map((r) => r.employeeId))].filter((id) => !onlyIds || onlyIds.includes(id));
      const people = ids.length
        ? await prisma.employee.findMany({
            where: { companyId, deletedAt: null, id: { in: ids }, AND: [scopeWhere ?? {}] },
            select: { id: true, firstName: true, lastName: true, nickname: true },
          })
        : [];
      const nameById = new Map(people.map((p) => [p.id, personText(p)]));
      const visible = rows
        .filter((r) => nameById.has(r.employeeId))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const LIMIT = 150;
      return JSON.stringify({
        from: range.from,
        to: range.to,
        ...(range.cut ? { cutShort: "ช่วงวันที่ยาวเกิน 31 วัน ตัดให้เหลือ 31 วันแรก" } : {}),
        total: visible.length,
        assignments: visible.slice(0, LIMIT).map((r) => ({
          date: r.date,
          employee: nameById.get(r.employeeId),
          shift: r.template.name,
          time: `${r.template.startTime}-${r.template.endTime}`,
          ...(r.note ? { note: r.note } : {}),
        })),
        ...(visible.length > LIMIT ? { note: `แสดง ${LIMIT} รายการแรกจาก ${visible.length}` } : {}),
      });
    }

    case "get_evaluation_progress": {
      // campaign:manage, not :read: every employee holds :read, and this lists who has not yet submitted.
      if (!can(session.perms, "campaign:manage")) return NO_PERM("campaign:manage");
      const q = typeof input.campaign === "string" ? input.campaign.trim() : "";
      const includeClosed = input.includeClosed === true;
      const campaigns = await prisma.evaluationCampaign.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: includeClosed ? { in: ["ACTIVE", "CLOSED"] } : "ACTIVE",
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, cycle: true, startDate: true, endDate: true, status: true },
        orderBy: { endDate: includeClosed ? "desc" : "asc" },
        take: includeClosed ? 3 : 5,
      });
      if (campaigns.length === 0) return (includeClosed ? "ไม่พบรอบประเมิน" : "ไม่มีรอบประเมินที่เปิดอยู่ (ถ้าต้องการดูรอบที่ปิดแล้วให้ใช้ includeClosed)") + (q ? ` ที่ชื่อตรงกับ "${q}"` : "");

      const inScope: Prisma.EvaluationParticipantWhereInput = { employee: { AND: [scopeWhere ?? {}] } };
      const results: unknown[] = [];
      for (const c of campaigns) {
        const participants = await prisma.evaluationParticipant.count({ where: { campaignId: c.id, ...inScope } });
        const finalized = await prisma.evaluationParticipant.count({ where: { campaignId: c.id, finalizedAt: { not: null }, ...inScope } });
        const grouped = await prisma.evaluationResponse.groupBy({
          by: ["raterType", "status"],
          where: { participant: { campaignId: c.id, ...inScope } },
          _count: { _all: true },
        });
        const byRater = new Map<string, { submitted: number; total: number }>();
        for (const g of grouped) {
          const cur = byRater.get(g.raterType) ?? { submitted: 0, total: 0 };
          cur.total += g._count._all;
          if (g.status === "SUBMITTED") cur.submitted += g._count._all;
          byRater.set(g.raterType, cur);
        }
        const pending = await prisma.evaluationResponse.findMany({
          where: { status: { in: ["PENDING", "IN_PROGRESS"] }, participant: { campaignId: c.id, ...inScope } },
          select: {
            raterType: true,
            raterEmployeeId: true,
            participant: { select: { employee: { select: { firstName: true, lastName: true, nickname: true } } } },
          },
          take: 15,
        });
        const raters = pending.length
          ? await prisma.employee.findMany({
              where: { companyId, id: { in: [...new Set(pending.map((p) => p.raterEmployeeId))] } },
              select: { id: true, firstName: true, lastName: true, nickname: true },
            })
          : [];
        const raterName = new Map(raters.map((r) => [r.id, personText(r)]));
        const submitted = [...byRater.values()].reduce((s, v) => s + v.submitted, 0);
        const total = [...byRater.values()].reduce((s, v) => s + v.total, 0);
        results.push({
          name: c.name,
          status: c.status === "ACTIVE" ? "เปิดอยู่" : "ปิดแล้ว",
          cycle: c.cycle,
          from: dayOf(c.startDate),
          closes: dayOf(c.endDate),
          participants,
          evaluationsSubmitted: submitted,
          evaluationsTotal: total,
          percentDone: percentDone(submitted, total),
          resultsFinalized: finalized,
          byRaterType: [...byRater.entries()].map(([type, v]) => ({ type, submitted: v.submitted, total: v.total, percentDone: percentDone(v.submitted, v.total) })),
          stillToSubmit: pending.map((p) => ({ rater: raterName.get(p.raterEmployeeId) ?? "-", raterType: p.raterType, about: personText(p.participant.employee) })),
          ...(total - submitted > pending.length ? { note: `แสดงผู้ที่ยังไม่ส่ง ${pending.length} รายการแรกจาก ${total - submitted}` } : {}),
        });
      }
      return JSON.stringify(results);
    }

    default:
      return null;
  }
}
