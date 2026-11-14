import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signAiProposalToken, type AccessClaims } from "@/lib/auth/jwt";
import { writeAudit } from "@/lib/audit";
import { displayName } from "@/lib/format";
import { PROPOSAL_TOOL_RESULT, type ConfirmOutcome, type ProposalCard, type ProposalPayload } from "@/features/ai/proposal";
import {
  buildQuotaCard,
  checkQuotaInput,
  MAX_QUOTA_ROWS,
  quotaRowProblem,
  quotaTypeLabel,
  type QuotaRow,
  type QuotaType,
} from "@/features/ai/quota-proposal";
import { getBalancesFor } from "@/features/leave/service";

type Meta = { ip?: string; userAgent?: string };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Entitlement now and days used for each paid type of one person (the company default when the person has no row yet). */
async function currentOf(companyId: string, employeeId: string, year: number) {
  const rows = await getBalancesFor(companyId, employeeId, year);
  return new Map(rows.map((b) => [b.type as string, { total: r1(b.totalDays), used: r1(b.usedDays) }]));
}

/** Draws the card for a leave quota change. Nothing is saved. */
export async function prepareQuotaProposal(
  session: AccessClaims,
  raw: Record<string, unknown>,
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<{ card: ProposalCard | null; message: string }> {
  const companyId = session.companyId;
  const input = checkQuotaInput(raw, new Date().getFullYear());
  if (!input.ok) return { card: null, message: input.message };

  const rows: QuotaRow[] = [];
  const skipped: string[] = [];
  const cache = new Map<string, Awaited<ReturnType<typeof currentOf>>>();
  // Sequential: the pooled connection serves one query at a time.
  for (const c of input.changes) {
    const found = await prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "ACTIVE",
        AND: [
          scopeWhere ?? {},
          {
            OR: [
              { employeeCode: { equals: c.employee, mode: "insensitive" } },
              { firstName: { contains: c.employee, mode: "insensitive" } },
              { lastName: { contains: c.employee, mode: "insensitive" } },
              { nickname: { equals: c.employee, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, nickname: true },
      take: 6,
    });
    if (found.length === 0) {
      skipped.push(`${c.employee}: ไม่พบพนักงานที่ทำงานอยู่ในขอบเขตของคุณ`);
      continue;
    }
    if (found.length > 1) {
      return { card: null, message: `"${c.employee}" ตรงกับหลายคน ให้ถามผู้ใช้ว่าหมายถึงคนไหน: ${found.map((e) => `${displayName(e)} (${e.employeeCode})`).join(", ")}` };
    }
    const e = found[0];
    if (!cache.has(e.id)) cache.set(e.id, await currentOf(companyId, e.id, input.year));
    const now = cache.get(e.id)!.get(c.type);
    if (!now) {
      skipped.push(`${displayName(e)}: ไม่พบข้อมูลโควตา${quotaTypeLabel(c.type)}`);
      continue;
    }
    const row: QuotaRow = { employeeId: e.id, name: displayName(e), type: c.type, before: now.total, after: c.totalDays, used: now.used };
    const problem = quotaRowProblem(row);
    if (problem) skipped.push(`${row.name} ${quotaTypeLabel(c.type)}: ${problem}`);
    else rows.push(row);
  }
  if (rows.length === 0) return { card: null, message: `ไม่มีรายการไหนที่ปรับได้ ให้บอกผู้ใช้ตามเหตุผลนี้ ไม่ต้องออกการ์ด: ${skipped.join("; ")}` };
  if (rows.length > MAX_QUOTA_ROWS) return { card: null, message: `เกิน ${MAX_QUOTA_ROWS} รายการ ให้แบ่งเป็นกลุ่มเล็กลง` };

  const payload: ProposalPayload = {
    kind: "adjust_leave_quota",
    title: `ปรับโควตา ${rows.length} รายการ`,
    body: "",
    count: rows.length,
    quota: { year: input.year, items: rows.map((r) => ({ employeeId: r.employeeId, type: r.type, before: r.before, after: r.after })) },
  };
  const token = await signAiProposalToken(session.sub, companyId, payload as unknown as Record<string, unknown>);
  return { card: buildQuotaCard(token, input.year, rows, skipped), message: PROPOSAL_TOOL_RESULT };
}

/**
 * Saves a confirmed quota card in ONE transaction (all or nothing). Before writing it checks that every
 * person is still active and inside the person's scope, that today's entitlement still equals what the card
 * showed, and that no new total is below the days already used. Reads back and audits.
 */
export async function confirmQuotaProposal(
  session: AccessClaims,
  p: ProposalPayload,
  scopeWhere: Prisma.EmployeeWhereInput | undefined,
  meta?: Meta,
): Promise<ConfirmOutcome> {
  const companyId = session.companyId;
  const q = p.quota;
  if (!q || q.items.length === 0 || q.items.length > MAX_QUOTA_ROWS) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };

  const ids = [...new Set(q.items.map((i) => i.employeeId))];
  const people = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", id: { in: ids }, AND: [scopeWhere ?? {}] },
    select: { id: true },
  });
  if (people.length !== ids.length) {
    return { status: "refused", message: "มีพนักงานที่ไม่ได้ทำงานแล้วหรืออยู่นอกขอบเขตของคุณ ยังไม่ได้เปลี่ยนอะไร ให้น้องวีบอทเตรียมใหม่" };
  }

  const cache = new Map<string, Awaited<ReturnType<typeof currentOf>>>();
  let alreadyAll = true;
  for (const it of q.items) {
    if (!cache.has(it.employeeId)) cache.set(it.employeeId, await currentOf(companyId, it.employeeId, q.year));
    const now = cache.get(it.employeeId)!.get(it.type);
    if (!now) return { status: "refused", message: "ไม่พบข้อมูลโควตาของบางรายการ ยังไม่ได้เปลี่ยนอะไร ให้น้องวีบอทเตรียมใหม่" };
    if (it.after < now.used) {
      return { status: "refused", message: `มีคนใช้ลาเพิ่มตั้งแต่เตรียมการ์ด โควตาที่ตั้งต่ำกว่าวันที่ใช้ไป ยังไม่ได้เปลี่ยนอะไร ให้น้องวีบอทเตรียมใหม่` };
    }
    if (r1(now.total) !== r1(it.after)) alreadyAll = false;
    if (r1(now.total) !== r1(it.before) && r1(now.total) !== r1(it.after)) {
      return { status: "refused", message: "โควตาเดิมของบางคนเปลี่ยนไปตั้งแต่เตรียมการ์ด ยังไม่ได้เปลี่ยนอะไร ให้น้องวีบอทเตรียมใหม่" };
    }
  }
  if (alreadyAll) return { status: "already", message: "โควตาเป็นค่าที่ตั้งไว้แล้วทั้งหมด ไม่ได้ปรับซ้ำ" };

  // Same write the entitlement page makes (setEntitlement): total days only, used days untouched.
  await prisma.$transaction(
    q.items.map((it) =>
      prisma.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: it.employeeId, year: q.year, type: it.type as QuotaType } },
        create: { companyId, employeeId: it.employeeId, year: q.year, type: it.type as QuotaType, totalDays: r1(it.after), usedDays: 0 },
        update: { totalDays: r1(it.after) },
        select: { id: true },
      }),
    ),
  );

  let wrong = 0;
  const after = new Map<string, Awaited<ReturnType<typeof currentOf>>>();
  for (const it of q.items) {
    if (!after.has(it.employeeId)) after.set(it.employeeId, await currentOf(companyId, it.employeeId, q.year));
    if (r1(after.get(it.employeeId)!.get(it.type)?.total ?? -1) !== r1(it.after)) wrong++;
  }
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai.adjust_leave_quota",
    entity: "LeaveBalance",
    before: q.items.map((i) => ({ employeeId: i.employeeId, type: i.type, totalDays: i.before })),
    after: { year: q.year, wrong, items: q.items.map((i) => ({ employeeId: i.employeeId, type: i.type, totalDays: i.after })) },
    ...meta,
  });
  if (wrong > 0) return { status: "refused", message: `บันทึกแล้วแต่ตรวจย้อนพบ ${wrong} รายการไม่ตรง แจ้ง HR ให้ตรวจที่หน้าโควตาวันลา` };
  return { status: "done", message: `ปรับโควตาแล้ว ${q.items.length} รายการ` };
}
