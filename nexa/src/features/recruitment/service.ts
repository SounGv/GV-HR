import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  CandidateCreateInput,
  CandidateUpdateInput,
  JobCreateInput,
  JobUpdateInput,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };
type JobStatus = "OPEN" | "CLOSED";
type CandidateStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";

const jobSelect = {
  id: true,
  title: true,
  departmentId: true,
  description: true,
  location: true,
  employmentType: true,
  openings: true,
  status: true,
  createdAt: true,
  _count: { select: { candidates: true } },
} satisfies Prisma.JobPostingSelect;

const candidateSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  note: true,
  stage: true,
  createdAt: true,
  jobPosting: { select: { id: true, title: true } },
} satisfies Prisma.CandidateSelect;

// ─────────────────────────── Jobs ───────────────────────────

export async function listJobs(companyId: string, status?: JobStatus) {
  const jobs = await prisma.jobPosting.findMany({
    where: { companyId, deletedAt: null, ...(status ? { status } : {}) },
    select: jobSelect,
    orderBy: { createdAt: "desc" },
  });
  const deptIds = [...new Set(jobs.map((j) => j.departmentId).filter(Boolean) as string[])];
  const depts = deptIds.length
    ? await prisma.department.findMany({
        where: { id: { in: deptIds } },
        select: { id: true, name: true },
      })
    : [];
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    departmentId: j.departmentId,
    departmentName: j.departmentId ? (deptMap.get(j.departmentId) ?? null) : null,
    description: j.description,
    location: j.location,
    employmentType: j.employmentType,
    openings: j.openings,
    status: j.status,
    candidateCount: j._count.candidates,
  }));
}

export async function createJob(
  companyId: string,
  session: AccessClaims,
  input: JobCreateInput,
  meta?: Meta,
) {
  const job = await prisma.jobPosting.create({
    data: { ...input, companyId, createdById: session.sub, updatedById: session.sub },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "job.create",
    entity: "JobPosting",
    entityId: job.id,
    after: { title: input.title },
    ...meta,
  });
  return { id: job.id };
}

export async function updateJob(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: JobUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.jobPosting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบตำแหน่งงาน");
  await prisma.jobPosting.update({
    where: { id },
    data: { ...input, updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "job.update",
    entity: "JobPosting",
    entityId: id,
    ...meta,
  });
  return { id };
}

export async function deleteJob(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.jobPosting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบตำแหน่งงาน");
  await prisma.jobPosting.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "job.delete",
    entity: "JobPosting",
    entityId: id,
    ...meta,
  });
}

// ─────────────────────────── Candidates ───────────────────────────

export async function listCandidates(
  companyId: string,
  filter: { jobPostingId?: string; stage?: CandidateStage },
) {
  return prisma.candidate.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(filter.jobPostingId ? { jobPostingId: filter.jobPostingId } : {}),
      ...(filter.stage ? { stage: filter.stage } : {}),
    },
    select: candidateSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function createCandidate(
  companyId: string,
  session: AccessClaims,
  input: CandidateCreateInput,
  meta?: Meta,
) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: input.jobPostingId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!job) throw NotFound("ไม่พบตำแหน่งงาน");

  const candidate = await prisma.candidate.create({
    data: { ...input, companyId, createdById: session.sub, updatedById: session.sub },
    select: candidateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "candidate.create",
    entity: "Candidate",
    entityId: candidate.id,
    after: { name: input.name, jobPostingId: input.jobPostingId },
    ...meta,
  });
  return candidate;
}

export async function updateCandidate(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: CandidateUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.candidate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบผู้สมัคร");

  const candidate = await prisma.candidate.update({
    where: { id },
    data: { ...input, updatedById: session.sub },
    select: candidateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "candidate.update",
    entity: "Candidate",
    entityId: id,
    after: input,
    ...meta,
  });
  return candidate;
}

export async function deleteCandidate(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.candidate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบผู้สมัคร");
  await prisma.candidate.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "candidate.delete",
    entity: "Candidate",
    entityId: id,
    ...meta,
  });
}
