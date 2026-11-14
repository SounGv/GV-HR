import { prisma } from "@/lib/prisma";
import { signAiProposalToken, type AccessClaims } from "@/lib/auth/jwt";
import { writeAudit } from "@/lib/audit";
import { PROPOSAL_TOOL_RESULT, type ConfirmOutcome, type ProposalCard, type ProposalPayload } from "@/features/ai/proposal";
import { buildTemplateCard, normalizeDraft, summarizeDraft, type DraftOption, type DraftTemplate } from "@/features/ai/template-proposal";
import { defaultOptionsFor } from "@/features/evaluation-template/question-defaults";
import { templateCreateSchema } from "@/features/evaluation-template/schema";
import { createTemplate } from "@/features/evaluation-template/service";
import type { AnswerType } from "@/features/evaluation-template/types";

type Meta = { ip?: string; userAgent?: string };

/** Keeps the signed card small enough to travel back to the confirm call. */
const MAX_DRAFT_JSON = 40_000;

const defaults = (t: string) => defaultOptionsFor(t as AnswerType) as DraftOption[] | undefined;

const asInput = (d: DraftTemplate) => ({
  name: d.name,
  description: d.description,
  evaluationType: d.evaluationType,
  aiGenerated: true,
  aiRationale: d.rationale,
  sections: d.sections.map((s, si) => ({
    name: s.name,
    order: si,
    questions: s.questions.map((q, qi) => ({
      text: q.text,
      helpText: q.helpText,
      answerType: q.answerType,
      options: q.options,
      weight: q.weight,
      required: q.required,
      order: qi,
      visibleTo: [] as never[],
    })),
  })),
});

/** The first thing the real form schema objects to, as text the model can act on. */
function schemaProblem(d: DraftTemplate): string | null {
  const parsed = templateCreateSchema.safeParse(asInput(d));
  if (parsed.success) return null;
  const i = parsed.error.issues[0];
  return `แบบประเมินไม่ผ่านการตรวจของระบบ: ${i?.message ?? "ข้อมูลไม่ถูกต้อง"} ให้แก้แล้วเรียกใหม่`;
}

/** Draws the card for a draft evaluation form. Nothing is saved. */
export async function prepareTemplateProposal(session: AccessClaims, raw: Record<string, unknown>): Promise<{ card: ProposalCard | null; message: string }> {
  const result = normalizeDraft(raw, defaults);
  if (!result.ok) return { card: null, message: result.message };
  const problem = schemaProblem(result.draft);
  if (problem) return { card: null, message: problem };
  if (JSON.stringify(result.draft).length > MAX_DRAFT_JSON) return { card: null, message: "แบบประเมินยาวเกินไป ให้ย่อคำถามหรือลดจำนวนข้อ" };

  const payload: ProposalPayload = {
    kind: "draft_evaluation_template",
    title: result.draft.name,
    body: "",
    count: summarizeDraft(result.draft).questions,
    template: result.draft as unknown as Record<string, unknown>,
  };
  const token = await signAiProposalToken(session.sub, session.companyId, payload as unknown as Record<string, unknown>);
  return { card: buildTemplateCard(token, result.draft, result.autoWeights), message: PROPOSAL_TOOL_RESULT };
}

/** Saves a confirmed draft as a DRAFT form (never published), checks it by reading it back, audits. */
export async function confirmTemplateProposal(session: AccessClaims, p: ProposalPayload, since: Date, meta?: Meta): Promise<ConfirmOutcome> {
  const companyId = session.companyId;
  const raw = p.template;
  if (!raw) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };
  // Same checks as when the card was drawn: the form rules may have changed in between.
  const result = normalizeDraft(raw, defaults);
  if (!result.ok) return { status: "refused", message: `${result.message} ยังไม่ได้บันทึกอะไร ให้น้องวีบอทเตรียมใหม่` };
  const problem = schemaProblem(result.draft);
  if (problem) return { status: "refused", message: `${problem} ยังไม่ได้บันทึกอะไร` };

  const already = await prisma.evaluationTemplate.findFirst({
    where: { companyId, createdById: session.sub, name: result.draft.name, createdAt: { gte: since }, deletedAt: null },
    select: { id: true },
  });
  if (already) return { status: "already", message: "บันทึกฉบับร่างนี้ไปแล้วก่อนหน้านี้ ไม่ได้บันทึกซ้ำ" };

  const { id } = await createTemplate(companyId, session, templateCreateSchema.parse(asInput(result.draft)), meta);
  const back = await prisma.evaluationTemplate.findFirst({
    where: { id, companyId },
    select: { status: true, sections: { select: { questions: { select: { id: true } } } } },
  });
  const s = summarizeDraft(result.draft);
  const savedQuestions = back?.sections.reduce((n, sec) => n + sec.questions.length, 0) ?? 0;
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai.create_evaluation_template",
    entity: "EvaluationTemplate",
    entityId: id,
    after: { name: result.draft.name, sections: s.sections, questions: s.questions, savedQuestions, status: back?.status },
    ...meta,
  });
  if (!back || back.status !== "DRAFT" || back.sections.length !== s.sections || savedQuestions !== s.questions) {
    return { status: "refused", message: "บันทึกแล้วแต่ตรวจย้อนไม่ตรงกับการ์ด แจ้ง HR ให้ตรวจแบบประเมินที่หน้าแบบประเมิน" };
  }
  return {
    status: "done",
    message: `บันทึกแบบประเมินฉบับร่างแล้ว ${s.sections} หมวด ${s.questions} ข้อ`,
    href: `/performance/templates/${id}/edit`,
    hrefLabel: "เปิดแบบประเมินเพื่อตรวจและแก้ไข",
  };
}
