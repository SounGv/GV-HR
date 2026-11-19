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

/** List rows: no resumeUrl, which can be a multi-MB base64 data URL (a list of them passes the response size cap). */
const candidateListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  note: true,
  stage: true,
  createdAt: true,
  jobPosting: { select: { id: true, title: true } },
} satisfies Prisma.CandidateSelect;

/** One candidate: the list fields plus the resume. */
const candidateSelect = {
  ...candidateListSelect,
  resumeUrl: true,
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

export async function getJob(companyId: string, id: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      departmentId: true,
      description: true,
      location: true,
      employmentType: true,
      openings: true,
      status: true,
    },
  });
  if (!job) throw NotFound("ไม่พบตำแหน่งงาน");
  return job;
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

export async function getCandidate(companyId: string, id: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: candidateSelect,
  });
  if (!candidate) throw NotFound("ไม่พบผู้สมัคร");
  return candidate;
}

export async function listCandidates(
  companyId: string,
  filter: { jobPostingId?: string; stage?: CandidateStage },
) {
  const rows = await prisma.candidate.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(filter.jobPostingId ? { jobPostingId: filter.jobPostingId } : {}),
      ...(filter.stage ? { stage: filter.stage } : {}),
    },
    select: candidateListSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  // Which rows have a resume, without loading the files themselves.
  const withResume = rows.length
    ? await prisma.candidate.findMany({
        where: { id: { in: rows.map((r) => r.id) }, resumeUrl: { not: null } },
        select: { id: true },
      })
    : [];
  const hasResume = new Set(withResume.map((r) => r.id));
  return rows.map((r) => ({ ...r, hasResume: hasResume.has(r.id) }));
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
    // Field names only: the values hold contact details and a resume file (up to ~3 MB) that do not belong in the log.
    after: { changedFields: Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined) },
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
