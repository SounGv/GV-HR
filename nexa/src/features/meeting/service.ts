import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { MeetingCreateInput, MeetingListQuery, MeetingRespondInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const attendeeSelect = {
  id: true,
  status: true,
  respondedAt: true,
  note: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.MeetingAttendeeSelect;

const meetingSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  organizer: { select: { id: true, firstName: true, lastName: true } },
  attendees: { select: attendeeSelect },
} satisfies Prisma.MeetingSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

/** HR-level (wildcard) may view/cancel any meeting; everyone else only their own. */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*");
}

function withMyResponse<T extends { attendees: { employee: { id: string }; status: string }[] }>(
  meeting: T,
  employeeId?: string,
) {
  const mine = employeeId ? meeting.attendees.find((a) => a.employee.id === employeeId) : undefined;
  return { ...meeting, myResponse: mine?.status };
}

export async function createMeeting(
  companyId: string,
  session: AccessClaims,
  input: MeetingCreateInput,
  meta?: Meta,
) {
  const organizerEmployeeId = requireEmployeeId(session);

  const attendeeIds = [...new Set(input.attendeeEmployeeIds)].filter((id) => id !== organizerEmployeeId);
  if (attendeeIds.length === 0) throw BadRequest("กรุณาเลือกผู้เข้าร่วมอย่างน้อย 1 คน");

  const attendees = await prisma.employee.findMany({
    where: { id: { in: attendeeIds }, companyId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (attendees.length !== attendeeIds.length) throw BadRequest("พบผู้เข้าร่วมที่ไม่ถูกต้อง");

  const organizer = await prisma.employee.findFirst({
    where: { id: organizerEmployeeId, companyId, deletedAt: null },
    select: { firstName: true, lastName: true },
  });

  const meeting = await prisma.meeting.create({
    data: {
      companyId,
      organizerEmployeeId,
      title: input.title,
      description: input.description,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
      createdById: session.sub,
      updatedById: session.sub,
      attendees: {
        create: attendees.map((a) => ({ employeeId: a.id })),
      },
    },
    select: meetingSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "meeting.create",
    entity: "Meeting",
    entityId: meeting.id,
    after: { title: input.title, attendeeCount: attendees.length },
    ...meta,
  });

  // Sequential — a pooled connection can only serve one query at a time, and
  // firing many concurrent notification creates at once exhausts the pool
  // wait queue (P2024) instead of just taking a bit longer.
  const when = fmtRange(input.startAt, input.endAt);
  for (const a of attendees) {
    await createNotification(
      companyId,
      a.id,
      {
        title: "คุณได้รับเชิญเข้าร่วมประชุม",
        body: `${input.title} — ${when}${organizer ? ` · นัดโดย ${organizer.firstName} ${organizer.lastName}` : ""}`,
        category: "meeting",
      },
      session.sub,
    );
  }

  return withMyResponse(meeting, organizerEmployeeId);
}

export async function listMeetings(companyId: string, session: AccessClaims, query: MeetingListQuery) {
  const employeeId = requireEmployeeId(session);

  const meetings = await prisma.meeting.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(query.scope === "organizer"
        ? { organizerEmployeeId: employeeId }
        : { attendees: { some: { employeeId } } }),
    },
    select: meetingSelect,
    orderBy: { startAt: "desc" },
    take: 200,
  });

  return meetings.map((m) => withMyResponse(m, employeeId));
}

export async function getMeeting(companyId: string, session: AccessClaims, id: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: meetingSelect,
  });
  if (!meeting) throw NotFound("ไม่พบการประชุม");

  const isOrganizer = meeting.organizer.id === session.employeeId;
  const isAttendee = meeting.attendees.some((a) => a.employee.id === session.employeeId);
  if (!isOrganizer && !isAttendee && !isHrLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูการประชุมนี้");
  }

  return withMyResponse(meeting, session.employeeId);
}

export async function cancelMeeting(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const meeting = await prisma.meeting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      organizerEmployeeId: true,
      attendees: { select: { employeeId: true } },
    },
  });
  if (!meeting) throw NotFound("ไม่พบการประชุม");
  if (meeting.organizerEmployeeId !== session.employeeId && !isHrLevel(session)) {
    throw Forbidden("ยกเลิกได้เฉพาะผู้นัดประชุม");
  }
  if (meeting.status !== "SCHEDULED") throw BadRequest("การประชุมนี้ถูกยกเลิกไปแล้ว");

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "CANCELLED", updatedById: session.sub },
    select: meetingSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "meeting.cancel",
    entity: "Meeting",
    entityId: meeting.id,
    ...meta,
  });

  for (const a of meeting.attendees) {
    await createNotification(
      companyId,
      a.employeeId,
      { title: "การประชุมถูกยกเลิก", body: meeting.title, category: "meeting" },
      session.sub,
    );
  }

  return withMyResponse(updated, session.employeeId);
}

export async function respondToMeeting(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: MeetingRespondInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);

  const meeting = await prisma.meeting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      organizerEmployeeId: true,
      attendees: { select: { id: true, employeeId: true, status: true } },
    },
  });
  if (!meeting) throw NotFound("ไม่พบการประชุม");
  if (meeting.status !== "SCHEDULED") throw BadRequest("การประชุมนี้ถูกยกเลิกไปแล้ว ไม่สามารถตอบรับได้");

  const attendee = meeting.attendees.find((a) => a.employeeId === employeeId);
  if (!attendee) throw Forbidden("คุณไม่ได้ถูกเชิญเข้าร่วมการประชุมนี้");

  const nextStatus = input.action === "accept" ? "ACCEPTED" : "DECLINED";

  await prisma.meetingAttendee.update({
    where: { id: attendee.id },
    data: { status: nextStatus, respondedAt: new Date(), note: input.note },
  });

  const updated = await prisma.meeting.findUniqueOrThrow({ where: { id: meeting.id }, select: meetingSelect });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `meeting.respond.${input.action}`,
    entity: "Meeting",
    entityId: meeting.id,
    after: { status: nextStatus },
    ...meta,
  });

  const responder = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: { firstName: true, lastName: true },
  });
  await createNotification(
    companyId,
    meeting.organizerEmployeeId,
    {
      title: nextStatus === "ACCEPTED" ? "ผู้เข้าร่วมตอบรับการประชุม" : "ผู้เข้าร่วมปฏิเสธการประชุม",
      body: `${responder ? `${responder.firstName} ${responder.lastName}` : "พนักงาน"} — ${meeting.title}`,
      category: "meeting",
    },
    session.sub,
  );

  return withMyResponse(updated, employeeId);
}

function fmtRange(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
  return `${fmt.format(start)} - ${new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(end)}`;
}
