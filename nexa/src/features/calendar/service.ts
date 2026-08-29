import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import { fullName } from "@/lib/format";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CalendarItem, CalendarMonth, MyDayStatus } from "./types";
import type { EventCreateInput, EventUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const DAY_MS = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMonth(
  companyId: string,
  month: string | undefined,
  employeeId?: string | null,
): Promise<CalendarMonth> {
  const m = month ?? currentMonth();
  const [y, mo] = m.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 1)); // exclusive
  const lastDay = new Date(end.getTime() - DAY_MS);

  const items: CalendarItem[] = [];

  const pushRange = (
    idBase: string,
    title: string,
    source: CalendarItem["source"],
    type: string,
    from: Date,
    to: Date,
    opts?: { eventId?: string; href?: string },
  ) => {
    let cur = new Date(Math.max(from.getTime(), start.getTime()));
    const stop = new Date(Math.min(to.getTime(), lastDay.getTime()));
    while (cur.getTime() <= stop.getTime()) {
      const day = iso(cur);
      items.push({ id: `${idBase}-${day}`, title, date: day, source, type, ...opts });
      cur = new Date(cur.getTime() + DAY_MS);
    }
  };

  // Sequential, not Promise.all — this app's pooled connection runs with
  // connection_limit=1, so concurrent Prisma calls can throw P2024 instead
  // of all five completing.
  const holidays = await prisma.holiday.findMany({
    where: { companyId, deletedAt: null, date: { gte: start, lt: end } },
    select: { id: true, name: true, date: true, type: true },
  });
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "APPROVED",
      startDate: { lt: end },
      endDate: { gte: start },
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });
  const courses = await prisma.trainingCourse.findMany({
    where: { companyId, deletedAt: null, scheduledDate: { gte: start, lt: end } },
    select: { id: true, title: true, scheduledDate: true },
  });
  const events = await prisma.calendarEvent.findMany({
    where: {
      companyId,
      deletedAt: null,
      startDate: { lt: end },
      OR: [{ endDate: null, startDate: { gte: start } }, { endDate: { gte: start } }],
    },
    select: { id: true, title: true, type: true, startDate: true, endDate: true },
  });
  const evaluations = await prisma.evaluationCampaign.findMany({
    where: {
      companyId,
      deletedAt: null,
      startDate: { lt: end },
      endDate: { gte: start },
    },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  for (const h of holidays) {
    items.push({
      id: `h-${h.id}`,
      title: h.name,
      date: iso(h.date),
      source: "holiday",
      type: h.type,
    });
  }
  for (const l of leaves) {
    pushRange(
      `l-${l.id}`,
      `ลา — ${fullName(l.employee.firstName, l.employee.lastName)}`,
      "leave",
      l.type,
      l.startDate,
      l.endDate,
    );
  }
  for (const c of evaluations) {
    pushRange(`ev-${c.id}`, `ประเมินผล: ${c.name}`, "evaluation", "campaign", c.startDate, c.endDate, {
      href: `/performance/campaigns/${c.id}`,
    });
  }
  for (const c of courses) {
    if (!c.scheduledDate) continue;
    items.push({
      id: `t-${c.id}`,
      title: `อบรม: ${c.title}`,
      date: iso(c.scheduledDate),
      source: "training",
      type: "training",
    });
  }
  for (const e of events) {
    pushRange(`e-${e.id}`, e.title, "event", e.type, e.startDate, e.endDate ?? e.startDate, { eventId: e.id });
  }

  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const myStatus = employeeId
    ? await getMyDayStatus(companyId, employeeId, start, lastDay, holidays, leaves)
    : undefined;

  return { month: m, items, myStatus };
}

/** Viewer's own day-by-day attendance status, from today backwards — future days are left unset. */
async function getMyDayStatus(
  companyId: string,
  employeeId: string,
  start: Date,
  lastDay: Date,
  holidays: { date: Date }[],
  leaves: { employeeId: string; startDate: Date; endDate: Date }[],
): Promise<Record<string, MyDayStatus>> {
  const todayIsoStr = iso(new Date());
  const rangeEnd = new Date(Math.min(lastDay.getTime(), new Date(`${todayIsoStr}T00:00:00.000Z`).getTime()));
  if (rangeEnd.getTime() < start.getTime()) return {};

  const holidaySet = new Set(holidays.map((h) => iso(h.date)));
  const myLeaves = leaves.filter((l) => l.employeeId === employeeId);
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, employeeId, workDate: { gte: start, lte: rangeEnd } },
    select: { workDate: true, clockInAt: true, status: true },
  });
  const recordByDate = new Map(records.map((r) => [iso(r.workDate), r]));

  const result: Record<string, MyDayStatus> = {};
  for (let cur = new Date(start); cur.getTime() <= rangeEnd.getTime(); cur = new Date(cur.getTime() + DAY_MS)) {
    const day = iso(cur);
    if (holidaySet.has(day)) {
      result[day] = "HOLIDAY";
      continue;
    }
    const onLeave = myLeaves.some((l) => l.startDate.getTime() <= cur.getTime() && cur.getTime() <= l.endDate.getTime());
    if (onLeave) {
      result[day] = "LEAVE";
      continue;
    }
    const rec = recordByDate.get(day);
    if (rec?.clockInAt) {
      result[day] = rec.status === "LATE" ? "LATE" : "PRESENT";
      continue;
    }
    const weekday = cur.getUTCDay();
    result[day] = weekday === 0 || weekday === 6 ? "WEEKEND" : "ABSENT";
  }
  return result;
}

export async function getEvent(companyId: string, id: string) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, title: true, description: true, type: true, startDate: true, endDate: true },
  });
  if (!event) throw NotFound("ไม่พบกิจกรรม");
  return event;
}

export async function createEvent(
  companyId: string,
  session: AccessClaims,
  input: EventCreateInput,
  meta?: Meta,
) {
  const record = await prisma.calendarEvent.create({
    data: {
      companyId,
      title: input.title,
      description: input.description,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calendar.create",
    entity: "CalendarEvent",
    entityId: record.id,
    after: { title: input.title },
    ...meta,
  });
  return record;
}

export async function updateEvent(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: EventUpdateInput,
  meta?: Meta,
) {
  const ev = await prisma.calendarEvent.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!ev) throw NotFound("ไม่พบกิจกรรม");

  const record = await prisma.calendarEvent.update({
    where: { id: ev.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ?? null } : {}),
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calendar.update",
    entity: "CalendarEvent",
    entityId: ev.id,
    ...meta,
  });
  return record;
}

export async function deleteEvent(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const ev = await prisma.calendarEvent.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!ev) throw NotFound("ไม่พบกิจกรรม");
  await prisma.calendarEvent.update({
    where: { id: ev.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calendar.delete",
    entity: "CalendarEvent",
    entityId: ev.id,
    ...meta,
  });
  return { ok: true as const };
}
