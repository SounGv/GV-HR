import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signAiProposalToken, type AccessClaims } from "@/lib/auth/jwt";
import { writeAudit } from "@/lib/audit";
import { displayName } from "@/lib/format";
import { employeeNameFilter } from "@/lib/ai/scope";
import { PROPOSAL_TOOL_RESULT, type ConfirmOutcome, type ProposalCard, type ProposalPayload } from "@/features/ai/proposal";
import { buildShiftCard, checkSize, countKinds, expandDates, planRows, MAX_PEOPLE, type ShiftRow } from "@/features/ai/shift-proposal";

type Meta = { ip?: string; userAgent?: string };

/** People who can be scheduled: not deleted, working or on leave. */
const SCHEDULABLE = ["ACTIVE", "ON_LEAVE"] as const;

/** Finds one person per name, nickname or code inside the asker's scope. Returns text instead when a name is missing or ambiguous. */
async function resolvePeople(
  companyId: string,
  names: string[],
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<{ people: { id: string; name: string }[] } | { message: string }> {
  const byId = new Map<string, string>();
  for (const q of names) {
    const found = await prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: [...SCHEDULABLE] },
        AND: [
          scopeWhere ?? {},
          employeeNameFilter(q),
        ],
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, nickname: true },
      take: 6,
    });
    if (found.length === 0) return { message: `ไม่พบพนักงานชื่อ "${q}" ในขอบเขตของคุณ ให้ถามผู้ใช้ให้ชัดเจนขึ้น` };
    if (found.length > 1) {
      return { message: `"${q}" ตรงกับหลายคน ให้ถามผู้ใช้ว่าหมายถึงคนไหน: ${found.map((e) => `${displayName(e)} (${e.employeeCode})`).join(", ")}` };
    }
    byId.set(found[0].id, displayName(found[0]));
  }
  return { people: [...byId].map(([id, name]) => ({ id, name })) };
}

/** Existing assignments for these people and days, keyed `${employeeId}|${date}`. */
async function loadExisting(companyId: string, employeeIds: string[], dates: string[]) {
  const rows = await prisma.shiftAssignment.findMany({
    where: { companyId, employeeId: { in: employeeIds }, date: { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) } },
    select: { employeeId: true, date: true, templateId: true, template: { select: { name: true } } },
  });
  return new Map(rows.map((r) => [`${r.employeeId}|${r.date.toISOString().slice(0, 10)}`, { templateId: r.templateId, name: r.template.name }]));
}

/** Draws the card for an assign_shifts request. Nothing is written. */
export async function prepareShiftProposal(
  session: AccessClaims,
  raw: Record<string, unknown>,
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<{ card: ProposalCard | null; message: string }> {
  const companyId = session.companyId;
  const fail = (message: string) => ({ card: null, message });

  const names = Array.isArray(raw.employees) ? raw.employees.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
  const uniqueNames = [...new Set(names)];
  const dates = expandDates({ dates: raw.dates, from: raw.from, to: raw.to, weekdays: raw.weekdays });
  if (!dates.ok) return fail(dates.message);
  const sizeProblem = checkSize(uniqueNames.length, dates.dates.length);
  if (sizeProblem) return fail(sizeProblem);

  // Sequential awaits, not Promise.all: the pooled connection serves one query at a time.
  const templates = await prisma.shiftTemplate.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true, startTime: true, endTime: true, breakMinutes: true },
    orderBy: { name: "asc" },
  });
  if (templates.length === 0) return fail("ยังไม่มีกะงานในระบบ ให้ HR สร้างกะที่หน้ากะงานก่อน");
  const wanted = typeof raw.shift === "string" ? raw.shift.trim().toLowerCase() : "";
  const list = templates.map((t) => `${t.name} ${t.startTime}-${t.endTime}`).join(", ");
  const exact = templates.filter((t) => t.name.toLowerCase() === wanted);
  const partial = templates.filter((t) => wanted !== "" && (t.name.toLowerCase().includes(wanted) || wanted.includes(t.name.toLowerCase())));
  const template = exact.length === 1 ? exact[0] : exact.length === 0 && partial.length === 1 ? partial[0] : null;
  if (!template) return fail(`ในระบบไม่มีกะที่ตรงกับ "${String(raw.shift ?? "")}" หรือตรงหลายกะ มีกะ: ${list} ให้ถามผู้ใช้ว่าหมายถึงกะไหน`);

  const resolved = await resolvePeople(companyId, uniqueNames, scopeWhere);
  if ("message" in resolved) return fail(resolved.message);
  const people = resolved.people;
  if (people.length > MAX_PEOPLE) return fail(`พนักงานเกิน ${MAX_PEOPLE} คน ให้แบ่งเป็นกลุ่มเล็กลง`);
  const recheck = checkSize(people.length, dates.dates.length);
  if (recheck) return fail(recheck);

  const existing = await loadExisting(companyId, people.map((p) => p.id), dates.dates);
  const rows = planRows(people, dates.dates, template.id, existing);
  const k = countKinds(rows);
  if (k.changing === 0) return fail("ทุกรายการมีกะนี้อยู่แล้ว ไม่ต้องตั้งเพิ่ม ให้บอกผู้ใช้ตามนี้ ไม่ต้องออกการ์ด");

  const payload: ProposalPayload = {
    kind: "assign_shifts",
    title: template.name,
    body: "",
    count: k.changing,
    shift: { templateId: template.id, employeeIds: people.map((p) => p.id), dates: dates.dates, changing: k.changing, replaced: k.replaced },
  };
  const token = await signAiProposalToken(session.sub, companyId, payload as unknown as Record<string, unknown>);
  return { card: buildShiftCard(token, template, rows), message: PROPOSAL_TOOL_RESULT };
}

/**
 * Writes a confirmed shift card. Checks the template, the people (still schedulable
 * and still inside the person's scope) and that today's assignments still match what the
 * card showed, then upserts every row in ONE transaction (all or nothing), reads back, audits.
 */
export async function confirmShiftProposal(
  session: AccessClaims,
  p: ProposalPayload,
  scopeWhere: Prisma.EmployeeWhereInput | undefined,
  meta?: Meta,
): Promise<ConfirmOutcome> {
  const companyId = session.companyId;
  const s = p.shift;
  if (!s || s.employeeIds.length === 0 || s.dates.length === 0) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };
  if (checkSize(s.employeeIds.length, s.dates.length)) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };

  const template = await prisma.shiftTemplate.findFirst({
    where: { id: s.templateId, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!template) return { status: "refused", message: "กะนี้ถูกลบหรือไม่มีแล้ว ยังไม่ได้บันทึกอะไร ให้น้องวีบอทเตรียมใหม่" };

  const people = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: { in: [...SCHEDULABLE] }, id: { in: s.employeeIds }, AND: [scopeWhere ?? {}] },
    select: { id: true, firstName: true, lastName: true, nickname: true },
  });
  if (people.length !== s.employeeIds.length) {
    return { status: "refused", message: "รายชื่อพนักงานเปลี่ยนไปหรืออยู่นอกขอบเขตของคุณ ยังไม่ได้บันทึกอะไร ให้น้องวีบอทเตรียมใหม่" };
  }

  const existing = await loadExisting(companyId, s.employeeIds, s.dates);
  const rows: ShiftRow[] = planRows(people.map((x) => ({ id: x.id, name: displayName(x) })), s.dates, template.id, existing);
  const k = countKinds(rows);
  if (k.changing === 0) return { status: "already", message: "ตั้งไว้แล้วทั้งหมด ไม่ได้ตั้งซ้ำ" };
  if (k.changing !== s.changing || k.replaced !== s.replaced) {
    return { status: "refused", message: `กะเดิมของคนในรายการเปลี่ยนไปตั้งแต่เตรียมการ์ด (จาก ${s.changing} เป็น ${k.changing} รายการ) ยังไม่ได้บันทึกอะไร ให้น้องวีบอทเตรียมใหม่` };
  }

  const changing = rows.filter((r) => r.kind !== "same");
  // One transaction: if any row fails, none is saved.
  await prisma.$transaction(
    changing.map((r) =>
      prisma.shiftAssignment.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: new Date(`${r.date}T00:00:00Z`) } },
        create: { companyId, employeeId: r.employeeId, templateId: template.id, date: new Date(`${r.date}T00:00:00Z`), createdById: session.sub, updatedById: session.sub },
        update: { templateId: template.id, updatedById: session.sub },
        select: { id: true },
      }),
    ),
  );

  const back = await loadExisting(companyId, s.employeeIds, s.dates);
  const wrong = rows.filter((r) => back.get(`${r.employeeId}|${r.date}`)?.templateId !== template.id).length;
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai.assign_shifts",
    entity: "ShiftAssignment",
    after: {
      shift: template.name,
      created: k.created,
      replaced: k.replaced,
      wrong,
      rows: changing.map((r) => ({ employeeId: r.employeeId, date: r.date, before: r.before?.name ?? null })),
    },
    ...meta,
  });
  if (wrong > 0) return { status: "refused", message: `บันทึกแล้วแต่ตรวจย้อนพบ ${wrong} รายการไม่ตรง แจ้ง HR ให้ตรวจที่หน้ากะงาน` };
  return { status: "done", message: `ตั้งกะแล้ว ${k.changing} รายการ` };
}
