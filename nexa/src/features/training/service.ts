import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound, Conflict } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CourseCreateInput, CourseUpdateInput, EnrollmentUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

const courseSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  provider: true,
  hours: true,
  location: true,
  scheduledDate: true,
  capacity: true,
  status: true,
  _count: { select: { enrollments: { where: { status: { not: "CANCELLED" } } } } },
} satisfies Prisma.TrainingCourseSelect;

export async function listCourses(companyId: string, session: AccessClaims) {
  const courses = await prisma.trainingCourse.findMany({
    where: { companyId, deletedAt: null },
    select: courseSelect,
    orderBy: [{ status: "asc" }, { scheduledDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const myEnrollments = session.employeeId
    ? await prisma.trainingEnrollment.findMany({
        where: { companyId, employeeId: session.employeeId },
        select: { id: true, courseId: true, status: true },
      })
    : [];
  const byCourse = new Map(myEnrollments.map((e) => [e.courseId, e]));

  return courses.map((c) => {
    const mine = byCourse.get(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      provider: c.provider,
      hours: c.hours,
      location: c.location,
      scheduledDate: c.scheduledDate,
      capacity: c.capacity,
      status: c.status,
      enrolledCount: c._count.enrollments,
      myEnrollment: mine ? { id: mine.id, status: mine.status } : null,
    };
  });
}

export async function listMyEnrollments(companyId: string, session: AccessClaims) {
  const employeeId = requireEmployeeId(session);
  return prisma.trainingEnrollment.findMany({
    where: { companyId, employeeId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      status: true,
      score: true,
      completedAt: true,
      course: {
        select: { id: true, title: true, category: true, hours: true, scheduledDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCourse(
  companyId: string,
  session: AccessClaims,
  input: CourseCreateInput,
  meta?: Meta,
) {
  const record = await prisma.trainingCourse.create({
    data: {
      companyId,
      title: input.title,
      description: input.description,
      category: input.category,
      provider: input.provider,
      hours: input.hours,
      location: input.location,
      scheduledDate: input.scheduledDate ?? null,
      capacity: input.capacity ?? null,
      status: input.status,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.create",
    entity: "TrainingCourse",
    entityId: record.id,
    after: { title: input.title },
    ...meta,
  });
  return record;
}

export async function updateCourse(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: CourseUpdateInput,
  meta?: Meta,
) {
  const course = await prisma.trainingCourse.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!course) throw NotFound("ไม่พบหลักสูตร");

  const record = await prisma.trainingCourse.update({
    where: { id: course.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.hours !== undefined ? { hours: input.hours } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.scheduledDate !== undefined ? { scheduledDate: input.scheduledDate ?? null } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.update",
    entity: "TrainingCourse",
    entityId: course.id,
    ...meta,
  });
  return record;
}

export async function deleteCourse(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const course = await prisma.trainingCourse.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!course) throw NotFound("ไม่พบหลักสูตร");
  await prisma.trainingCourse.update({
    where: { id: course.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.delete",
    entity: "TrainingCourse",
    entityId: course.id,
    ...meta,
  });
  return { ok: true as const };
}

export async function enrollSelf(
  companyId: string,
  session: AccessClaims,
  courseId: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const course = await prisma.trainingCourse.findFirst({
    where: { id: courseId, companyId, deletedAt: null },
    select: { id: true, status: true, capacity: true },
  });
  if (!course) throw NotFound("ไม่พบหลักสูตร");
  if (course.status !== "OPEN") throw BadRequest("หลักสูตรนี้ปิดรับสมัครแล้ว");

  const existing = await prisma.trainingEnrollment.findUnique({
    where: { courseId_employeeId: { courseId, employeeId } },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "CANCELLED") {
    throw Conflict("คุณลงทะเบียนหลักสูตรนี้แล้ว");
  }

  if (course.capacity != null) {
    const count = await prisma.trainingEnrollment.count({
      where: { courseId, status: { not: "CANCELLED" } },
    });
    if (count >= course.capacity) throw BadRequest("หลักสูตรเต็มแล้ว");
  }

  const record = existing
    ? await prisma.trainingEnrollment.update({
        where: { id: existing.id },
        data: { status: "ENROLLED", updatedById: session.sub },
        select: { id: true },
      })
    : await prisma.trainingEnrollment.create({
        data: {
          companyId,
          courseId,
          employeeId,
          status: "ENROLLED",
          createdById: session.sub,
          updatedById: session.sub,
        },
        select: { id: true },
      });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.enroll",
    entity: "TrainingEnrollment",
    entityId: record.id,
    ...meta,
  });
  return record;
}

export async function cancelEnrollment(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const enr = await prisma.trainingEnrollment.findFirst({
    where: { id, companyId },
    select: { id: true, employeeId: true },
  });
  if (!enr) throw NotFound("ไม่พบการลงทะเบียน");
  if (enr.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะการลงทะเบียนของตนเอง");

  await prisma.trainingEnrollment.update({
    where: { id: enr.id },
    data: { status: "CANCELLED", updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.cancel",
    entity: "TrainingEnrollment",
    entityId: enr.id,
    ...meta,
  });
  return { ok: true as const };
}

/** HR marks completion / score — caller must hold training:update (route-enforced). */
export async function updateEnrollment(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: EnrollmentUpdateInput,
  meta?: Meta,
) {
  const enr = await prisma.trainingEnrollment.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!enr) throw NotFound("ไม่พบการลงทะเบียน");

  const record = await prisma.trainingEnrollment.update({
    where: { id: enr.id },
    data: {
      status: input.status,
      score: input.score ?? null,
      completedAt: input.status === "COMPLETED" ? new Date() : null,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "training.grade",
    entity: "TrainingEnrollment",
    entityId: enr.id,
    ...meta,
  });
  return record;
}
