import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { notifyPermissionHolders } from "@/features/notification/service";
import { PRESETS, PRESET_WEIGHTS } from "./rules";
import { checkRecurrence, dueOccurrences, roundName, upcomingOccurrences, type Frequency, type Occurrence, type PresetKey } from "./recurrence-rules";
import type { RecurrenceInput as RecurrenceBody } from "./schema";
import type { RecurrenceItem } from "./types";

type Meta = { ip?: string; userAgent?: string };

/**
 * Recurring rounds: HR set "every month, open on day 1, close on day 7" once, and the daily job makes each round as a DRAFT
 * a few days before it opens and tells HR, who check the people and press open. The job never opens a round (owner's decision,
 * 15 Nov 2026) and never changes a score. Everything here is for HR (`campaign:update`).
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const fmtDay = (day: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(asDate(day));
const todayIso = () => iso(bangkokParts().dateUTC);

/** A published form to use now: the saved one, or the newest published version of the same form. Null when there is none. */
async function usableForm(companyId: string, formId: string): Promise<{ id: string; name: string } | null> {
  const saved = await prisma.appraisalForm.findFirst({ where: { id: formId, companyId }, select: { id: true, name: true, lineageId: true, status: true, deletedAt: true } });
  if (!saved) return null;
  if (saved.status === "PUBLISHED" && !saved.deletedAt) return { id: saved.id, name: saved.name };
  const newer = await prisma.appraisalForm.findFirst({
    where: { companyId, lineageId: saved.lineageId, status: "PUBLISHED", deletedAt: null },
    orderBy: { version: "desc" },
    select: { id: true, name: true },
  });
  return newer;
}

export async function listRecurrences(companyId: string): Promise<RecurrenceItem[]> {
  const rows = await prisma.appraisalRecurrence.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      frequency: true,
      openDay: true,
      closeDay: true,
      formId: true,
      preset: true,
      departmentNames: true,
      enabled: true,
      form: { select: { name: true } },
    },
  });
  const today = todayIso();
  const out: RecurrenceItem[] = [];
  for (const r of rows) {
    const made = await prisma.appraisalRound.count({ where: { recurrenceId: r.id } });
    const last = await prisma.appraisalRound.findFirst({
      where: { recurrenceId: r.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, deletedAt: true },
    });
    out.push({
      id: r.id,
      name: r.name,
      frequency: r.frequency,
      openDay: r.openDay,
      closeDay: r.closeDay,
      formId: r.formId,
      formName: r.form.name,
      preset: r.preset,
      departmentNames: r.departmentNames,
      enabled: r.enabled,
      upcoming: upcomingOccurrences(today, r, 3).map((o) => ({ periodKey: o.periodKey, name: roundName(r.name, o), startIso: o.startIso, endIso: o.endIso })),
      roundsMade: made,
      lastRound: last && !last.deletedAt ? { id: last.id, name: last.name, status: last.status } : null,
    });
  }
  return out;
}

/** @param checkForm False when the form is unchanged: a setup whose form was since replaced can still be stopped or renamed (the job finds the newer version). */
async function validate(companyId: string, body: RecurrenceBody, checkForm = true) {
  const problem = checkRecurrence(body);
  if (problem) throw BadRequest(problem);
  if (!checkForm) return;
  const form = await prisma.appraisalForm.findFirst({ where: { id: body.formId, companyId, deletedAt: null, status: "PUBLISHED" }, select: { id: true } });
  if (!form) throw BadRequest("เลือกได้เฉพาะแบบประเมินที่ใช้งานแล้ว");
}

const clean = (b: RecurrenceBody) => ({
  name: b.name.trim(),
  frequency: b.frequency,
  openDay: b.openDay,
  closeDay: b.closeDay,
  formId: b.formId,
  preset: b.preset,
  departmentNames: [...new Set(b.departmentNames.map((d) => d.trim()).filter(Boolean))],
});

export async function createRecurrence(companyId: string, session: AccessClaims, body: RecurrenceBody, meta?: Meta) {
  await validate(companyId, body);
  const row = await prisma.appraisalRecurrence.create({
    data: { companyId, ...clean(body), enabled: body.enabled ?? true, createdById: session.sub, updatedById: session.sub },
    select: { id: true },
  });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_recurrence.create", entity: "AppraisalRecurrence", entityId: row.id, after: clean(body), ...meta });
  return row;
}

async function loadOne(companyId: string, id: string) {
  const row = await prisma.appraisalRecurrence.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, formId: true } });
  if (!row) throw NotFound("ไม่พบการตั้งรอบอัตโนมัติ");
  return row;
}

export async function updateRecurrence(companyId: string, session: AccessClaims, id: string, body: RecurrenceBody, meta?: Meta) {
  const current = await loadOne(companyId, id);
  await validate(companyId, body, body.formId !== current.formId);
  await prisma.appraisalRecurrence.update({ where: { id }, data: { ...clean(body), ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_recurrence.update", entity: "AppraisalRecurrence", entityId: id, after: { ...clean(body), enabled: body.enabled }, ...meta });
  return { id };
}

/** Stops the setup for good. Rounds it already made stay as they are. */
export async function deleteRecurrence(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  await loadOne(companyId, id);
  await prisma.appraisalRecurrence.update({ where: { id }, data: { deletedAt: new Date(), enabled: false, updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_recurrence.delete", entity: "AppraisalRecurrence", entityId: id, ...meta });
  return { id };
}

/* ───────────────────────── the daily job ───────────────────────── */

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Makes the draft rounds that are due today, for every company. Safe to run twice: a round is made once per period (the
 * database refuses a second one), and a round HR deleted is not made again. On the opening day it also nudges HR if the draft
 * is still waiting to be opened.
 *
 * @param today Bangkok calendar day, "YYYY-MM-DD" (a parameter so tests can pick the day).
 */
export async function makeDueRecurringRounds(today: string = todayIso()) {
  const summary = { made: 0, nudged: 0, skipped: 0 };
  const setups = await prisma.appraisalRecurrence.findMany({
    where: { enabled: true, deletedAt: null },
    select: { id: true, companyId: true, name: true, frequency: true, openDay: true, closeDay: true, formId: true, preset: true, departmentNames: true },
  });

  for (const r of setups) {
    for (const occ of dueOccurrences(today, r)) {
      const name = roundName(r.name, occ);
      // Includes rounds HR deleted: a deleted draft is a decision, not something to remake tomorrow.
      const existing = await prisma.appraisalRound.findFirst({ where: { recurrenceId: r.id, periodKey: occ.periodKey }, select: { id: true, status: true, deletedAt: true } });
      if (existing) {
        if (!existing.deletedAt && existing.status === "DRAFT" && today === occ.startIso) {
          await tellHr(r.companyId, existing.id, "ถึงวันเปิดรอบแล้ว รอ HR กดเปิด", `${name} ถึงวันเปิดแล้ว (${fmtDay(occ.startIso)}) ตรวจรายชื่อและผู้ประเมิน แล้วกดเปิดรอบ`);
          summary.nudged++;
        }
        continue;
      }
      const form = await usableForm(r.companyId, r.formId);
      if (!form) {
        summary.skipped++;
        if (today === occ.draftFromIso || today === occ.startIso) {
          await tellHr(r.companyId, null, "สร้างรอบอัตโนมัติไม่ได้", `${name} สร้างไม่ได้ เพราะแบบประเมินที่เลือกไว้ไม่ได้ใช้งานแล้วและยังไม่มีเวอร์ชันใหม่ที่ยืนยันใช้ ตั้งแบบประเมินใหม่ที่หน้ารอบอัตโนมัติ`);
        }
        continue;
      }
      const people = await prisma.employee.findMany({
        where: { companyId: r.companyId, deletedAt: null, status: "ACTIVE", ...(r.departmentNames.length ? { department: { name: { in: r.departmentNames } } } : {}) },
        select: { id: true, department: { select: { name: true } }, position: { select: { title: true } } },
      });
      if (people.length === 0) {
        summary.skipped++;
        continue;
      }
      const preset = r.preset as PresetKey;
      let roundId: string;
      try {
        const created = await prisma.appraisalRound.create({
          data: {
            companyId: r.companyId,
            name,
            formId: form.id,
            raterTypes: [...PRESETS[preset]],
            perspectiveWeights: PRESET_WEIGHTS[preset] as Prisma.InputJsonValue,
            startDate: asDate(occ.startIso),
            endDate: asDate(occ.endIso),
            recurrenceId: r.id,
            periodKey: occ.periodKey,
            participants: { create: people.map((p) => ({ employeeId: p.id, departmentName: p.department?.name ?? null, positionName: p.position?.title ?? null })) },
          },
          select: { id: true },
        });
        roundId = created.id;
      } catch (e) {
        if (isDuplicate(e)) continue; // another run made it a moment ago
        throw e;
      }
      await writeAudit({
        companyId: r.companyId,
        action: "appraisal_round.auto_create",
        entity: "AppraisalRound",
        entityId: roundId,
        after: { recurrenceId: r.id, periodKey: occ.periodKey, name, participants: people.length },
      });
      await tellHr(r.companyId, roundId, "ร่างรอบประเมินพร้อมให้ตรวจ", `${name} เปิดวันที่ ${fmtDay(occ.startIso)} มี ${people.length} คน ตรวจรายชื่อและผู้ประเมิน แล้วกดเปิดรอบ ระบบไม่เปิดให้เอง`);
      summary.made++;
    }
  }
  return summary;
}

/** In-app bell only (category "system"): the owner keeps LINE for leave, OT, corrections and evaluation invitations. */
async function tellHr(companyId: string, roundId: string | null, title: string, body: string) {
  await notifyPermissionHolders(companyId, "campaign:update", null, { title, body, category: "system", link: roundId ? `/appraisal/rounds/${roundId}` : "/appraisal/recurring" });
}

export type { Frequency, Occurrence };
