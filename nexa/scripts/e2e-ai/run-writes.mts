/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next and the model SDK */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { prisma as real } from "@real/prisma";
import { signAccessToken } from "@/lib/auth/jwt";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as confirm } from "@/app/api/ai/confirm/route";

// Nothing may leave the building: no LINE push, no email, whatever the data says.
for (const k of Object.keys(process.env)) if (k.startsWith("LINE_") || k.startsWith("RESEND") || k.startsWith("SMTP")) delete process.env[k];

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
class Rollback extends Error {}
let USER_ID = "";
let STARTED = new Date();

async function asUser(perms: string[], employeeId?: string) {
  g.__token = await signAccessToken({ sub: USER_ID, companyId: COMPANY, email: null, username: null, roles: ["Super Admin"], perms, employeeId });
}
async function call(handler: (r: NextRequest) => Promise<Response>, url: string, body: unknown) {
  const req = new NextRequest(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const res = await handler(req);
  return { status: res.status, json: (await res.json()) as any };
}
const model = (...r: unknown[]) => { g.__script = [...r]; g.__calls = []; };
const toolUse = (name: string, input: unknown) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name, input }] });
const say = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });
const draw = async (tool: string, input: unknown) => {
  model(toolUse(tool, input), say("เตรียมแล้ว"));
  const r = await call(chat, "/api/ai/chat", { messages: [{ role: "user", content: "ทดสอบ" }] });
  assert.equal(r.status, 200);
  return { card: r.json.data.proposals[0], text: g.__calls[1]?.messages?.at(-1)?.content?.[0]?.content as string | undefined };
};
const press = async (card: { token: string }) => (await call(confirm, "/api/ai/confirm", { token: card.token })).json.data;
const audit = (action: string) => prisma.auditLog.count({ where: { action, actorUserId: USER_ID, createdAt: { gte: STARTED } } });

const results: { name: string; ok: boolean; err?: string }[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e: any) {
    results.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 5).join(" | ") });
  }
}

const snapshot = async () => ({
  notifications: await real.notification.count(),
  announcements: await real.announcement.count(),
  templates: await real.evaluationTemplate.count(),
  shifts: await real.shiftAssignment.count(),
  balances: await real.leaveBalance.count(),
  leaveRows: await real.leaveRequest.count(),
  leaveUsed: (await real.leaveBalance.aggregate({ _sum: { usedDays: true, totalDays: true } }))._sum,
  corrections: await real.attendanceCorrectionRequest.count(),
  records: await real.attendanceRecord.count(),
  audit: await real.auditLog.count(),
});

(async () => {
  const adminId = (await real.employee.findFirst({ where: { companyId: COMPANY, nickname: { equals: "Admin", mode: "insensitive" }, deletedAt: null }, select: { id: true } }))!.id;
  const audience = await real.employee.count({ where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } } });
  const morning = (await real.shiftTemplate.findFirst({ where: { companyId: COMPANY, name: "กะเช้า", deletedAt: null }, select: { id: true } }))!.id;
  const afternoon = (await real.shiftTemplate.findFirst({ where: { companyId: COMPANY, name: "กะบ่าย", deletedAt: null }, select: { id: true } }))!.id;
  // The audit log needs a real user to point at (read only: any existing user will do, nothing is written to it).
  USER_ID = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const before = await snapshot();

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        STARTED = new Date(Date.now() - 1000);
        await asUser(["*"]); // HR rights, no employee record: nobody is approving their own request

        await t("W1 notification: card -> confirm sends to 1 person -> repeat press does not send twice -> audited", async () => {
          const { card } = await draw("send_notification", { target: "Admin", title: "ทดสอบน้องวีบอท", body: "ข้อความทดสอบ" });
          assert.equal(card.confirmLabel, "ยืนยัน ส่งถึง 1 คน");
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          assert.equal(a.message, "ส่งแจ้งเตือนแล้ว ถึง 1 คน");
          assert.equal(await prisma.notification.count({ where: { employeeId: adminId, title: "ทดสอบน้องวีบอท", category: "ai" } }), 1);
          const b = await press(card);
          assert.equal(b.status, "already");
          assert.equal(await prisma.notification.count({ where: { employeeId: adminId, title: "ทดสอบน้องวีบอท" } }), 1);
          assert.equal(await audit("ai.send_notification"), 1);
        });

        await t("W1b two cards with the same words but different people: sending one does not block the other", async () => {
          const other = await prisma.employee.findFirst({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE", id: { not: adminId } }, select: { id: true, employeeCode: true } });
          const a = await draw("send_notification", { target: "Admin", title: "ข้อความซ้ำ", body: "เหมือนกัน" });
          const b = await draw("send_notification", { target: other!.employeeCode, title: "ข้อความซ้ำ", body: "เหมือนกัน" });
          assert.equal((await press(b.card)).status, "done", "card B first");
          assert.equal((await press(a.card)).status, "done", "card A must still send to its own person");
          assert.equal(await prisma.notification.count({ where: { title: "ข้อความซ้ำ", employeeId: { in: [adminId, other!.id] } } }), 2);
          assert.equal((await press(a.card)).status, "already");
        });

        await t("W2 announcement: confirm publishes, notifies everyone, repeat press does nothing", async () => {
          const notifBefore = await prisma.notification.count({ where: { category: "announcement" } });
          const { card } = await draw("create_announcement", { title: "ประกาศทดสอบ", body: "เนื้อหาทดสอบ" });
          assert.match(card.rows[0].value, new RegExp(String(audience)));
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          assert.equal(a.message, `เผยแพร่ประกาศแล้ว ถึง ${audience} คน`);
          const ann = await prisma.announcement.findFirst({ where: { title: "ประกาศทดสอบ", createdById: USER_ID }, select: { status: true } });
          assert.equal(ann?.status, "PUBLISHED");
          assert.equal((await prisma.notification.count({ where: { category: "announcement" } })) - notifBefore, audience);
          assert.equal((await press(card)).status, "already");
          assert.equal(await prisma.announcement.count({ where: { title: "ประกาศทดสอบ" } }), 1);
          assert.equal(await audit("ai.create_announcement"), 1);
        });

        await t("W3 shifts: new rows, one replaced shift, saved together, repeat press, and a changed day refuses", async () => {
          const d = (s: string) => new Date(`${s}T00:00:00Z`);
          await prisma.shiftAssignment.create({ data: { companyId: COMPANY, employeeId: adminId, templateId: afternoon, date: d("2099-12-31") } });
          const { card } = await draw("assign_shifts", { employees: ["Admin"], shift: "กะเช้า", dates: ["2099-12-30", "2099-12-31"] });
          assert.equal(card.title, "ตั้งกะเช้า 2 รายการ");
          assert.ok(card.rows.some((r: any) => r.value.includes("แทนกะเดิม 1")), JSON.stringify(card.rows));
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          const rows = await prisma.shiftAssignment.findMany({ where: { employeeId: adminId, date: { in: [d("2099-12-30"), d("2099-12-31")] } }, select: { templateId: true } });
          assert.equal(rows.length, 2);
          assert.ok(rows.every((r) => r.templateId === morning));
          assert.equal((await press(card)).status, "already");
          const stale = await draw("assign_shifts", { employees: ["Admin"], shift: "กะเช้า", dates: ["2099-12-29"] });
          await prisma.shiftAssignment.create({ data: { companyId: COMPANY, employeeId: adminId, templateId: afternoon, date: d("2099-12-29") } });
          const refused = await press(stale.card);
          assert.equal(refused.status, "refused");
          assert.match(refused.message, /กะเดิมของคนในรายการเปลี่ยนไป/);
          assert.equal((await prisma.shiftAssignment.findFirst({ where: { employeeId: adminId, date: d("2099-12-29") } }))?.templateId, afternoon, "a refused card changes nothing");
          assert.equal(await audit("ai.assign_shifts"), 1);
        });

        await t("W4 quota: raised and read back, repeat press, a changed value refuses, never below days used", async () => {
          const year = new Date().getFullYear();
          const get = () => prisma.leaveBalance.findUnique({ where: { employeeId_year_type: { employeeId: adminId, year, type: "ANNUAL" } }, select: { totalDays: true, usedDays: true } });
          const row0 = await get();
          const total0 = row0?.totalDays ?? 10;
          const { card } = await draw("adjust_leave_quota", { changes: [{ employee: "Admin", type: "ANNUAL", totalDays: total0 + 2 }] });
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          const row1 = await get();
          assert.equal(row1?.totalDays, total0 + 2);
          assert.equal(row1?.usedDays, row0?.usedDays ?? 0, "days used are never touched");
          assert.equal((await press(card)).status, "already");
          const second = await draw("adjust_leave_quota", { changes: [{ employee: "Admin", type: "ANNUAL", totalDays: total0 + 3 }] });
          await prisma.leaveBalance.update({ where: { employeeId_year_type: { employeeId: adminId, year, type: "ANNUAL" } }, data: { totalDays: total0 + 9 } });
          const refused = await press(second.card);
          assert.equal(refused.status, "refused");
          assert.match(refused.message, /โควตาเดิม/);
          assert.equal((await get())?.totalDays, total0 + 9, "a refused card changes nothing");
          const below = await draw("adjust_leave_quota", { changes: [{ employee: "Admin", type: "ANNUAL", totalDays: -1 }] });
          assert.equal(below.card, undefined);
          assert.equal(await audit("ai.adjust_leave_quota"), 1);
        });

        await t("W5 evaluation form: saved as a DRAFT with every question, repeat press, link to the editor", async () => {
          const { card } = await draw("draft_evaluation_template", {
            name: "ฟอร์มทดสอบน้องวีบอท",
            sections: [
              { name: "งาน", questions: [{ text: "ทำงานแม่นยำ", answerType: "NUMERIC" }, { text: "ตรงเวลา", answerType: "NUMERIC" }, { text: "ปลอดภัย", answerType: "YES_NO" }] },
              { name: "ทีม", questions: [{ text: "ช่วยเพื่อน", answerType: "NUMERIC" }, { text: "ข้อเสนอแนะ", answerType: "LONG_TEXT" }] },
            ],
          });
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          assert.match(a.href, /^\/performance\/templates\/[0-9a-f-]{36}\/edit$/);
          const tpl = await prisma.evaluationTemplate.findFirst({ where: { name: "ฟอร์มทดสอบน้องวีบอท" }, select: { status: true, aiGenerated: true, sections: { select: { questions: { select: { weight: true, answerType: true } } } } } });
          assert.equal(tpl?.status, "DRAFT");
          assert.equal(tpl?.aiGenerated, true);
          const qs = tpl!.sections.flatMap((s) => s.questions);
          assert.equal(qs.length, 5);
          assert.equal(qs.filter((q) => q.answerType !== "LONG_TEXT").reduce((s, q) => s + q.weight, 0), 100);
          assert.equal((await press(card)).status, "already");
          assert.equal(await prisma.evaluationTemplate.count({ where: { name: "ฟอร์มทดสอบน้องวีบอท" } }), 1);
        });

        await t("W6 approvals: two leaves and a time correction approved one by one, balance used, repeat press, short balance skipped", async () => {
          const year = new Date().getFullYear();
          // The 2099 balance has to exist with days in it (the company default for this account is 0).
          await prisma.leaveBalance.create({ data: { companyId: COMPANY, employeeId: adminId, year: 2099, type: "ANNUAL", totalDays: 10, usedDays: 0 } });
          const leave = (start: string, days = 1) => prisma.leaveRequest.create({ data: { companyId: COMPANY, employeeId: adminId, type: "ANNUAL", startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${start}T00:00:00Z`), days }, select: { id: true } });
          const used0 = (await prisma.leaveBalance.findUnique({ where: { employeeId_year_type: { employeeId: adminId, year: new Date(`2099-06-01`).getUTCFullYear(), type: "ANNUAL" } }, select: { usedDays: true } }))?.usedDays ?? 0;
          void year;
          const l1 = await leave("2099-06-01");
          const l2 = await leave("2099-06-02");
          const huge = await leave("2099-06-03", 999);
          const corr = await prisma.attendanceCorrectionRequest.create({
            data: { companyId: COMPANY, employeeId: adminId, workDate: new Date("2099-06-01T00:00:00Z"), requestedClockIn: new Date("2099-06-01T01:55:00Z"), requestedClockOut: new Date("2099-06-01T11:02:00Z"), reason: "ทดสอบ" },
            select: { id: true },
          });
          const { card } = await draw("approve_requests", { requests: [{ kind: "leave", id: l1.id }, { kind: "leave", id: l2.id }, { kind: "leave", id: huge.id }, { kind: "correction", id: corr.id }] });
          assert.equal(card.title, "อนุมัติ 3 รายการ", JSON.stringify(card.skipped ?? card.rows));
          assert.equal(card.skipped.items.length, 1);
          assert.match(card.skipped.items[0], /คงเหลือไม่พอ/);
          const a = await press(card);
          assert.equal(a.status, "done", JSON.stringify(a));
          assert.equal(a.message, "อนุมัติแล้ว 3 รายการ");
          const st = await prisma.leaveRequest.findMany({ where: { id: { in: [l1.id, l2.id, huge.id] } }, select: { id: true, status: true } });
          assert.equal(st.find((x) => x.id === l1.id)?.status, "APPROVED");
          assert.equal(st.find((x) => x.id === l2.id)?.status, "APPROVED");
          assert.equal(st.find((x) => x.id === huge.id)?.status, "PENDING", "the skipped request is left alone");
          assert.equal((await prisma.attendanceCorrectionRequest.findUnique({ where: { id: corr.id }, select: { status: true } }))?.status, "APPROVED");
          const used1 = (await prisma.leaveBalance.findUnique({ where: { employeeId_year_type: { employeeId: adminId, year: 2099, type: "ANNUAL" } }, select: { usedDays: true } }))?.usedDays ?? 0;
          assert.equal(used1 - used0, 2, "two days came out of the balance");
          assert.equal((await press(card)).status, "already");
          assert.equal(await audit("ai.approve_requests"), 1);
        });

        await t("W7 approvals stop at the first request that cannot be approved and say how far they got", async () => {
          const leave = (start: string) => prisma.leaveRequest.create({ data: { companyId: COMPANY, employeeId: adminId, type: "SICK", startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${start}T00:00:00Z`), days: 1 }, select: { id: true } });
          const a1 = await leave("2099-07-01");
          const a2 = await leave("2099-07-02");
          const a3 = await leave("2099-07-03");
          const { card } = await draw("approve_requests", { requests: [a1, a2, a3].map((x) => ({ kind: "leave", id: x.id })) });
          assert.equal(card.title, "อนุมัติ 3 รายการ");
          await prisma.leaveRequest.update({ where: { id: a2.id }, data: { status: "CANCELLED" } });
          const r = await press(card);
          assert.equal(r.status, "refused");
          assert.match(r.message, /อนุมัติแล้ว 1 จาก 3 รายการ แล้วหยุดที่รายการที่ 2/);
          assert.match(r.message, /ยังคงอนุมัติ/);
          const st = await prisma.leaveRequest.findMany({ where: { id: { in: [a1.id, a2.id, a3.id] } }, select: { id: true, status: true } });
          assert.equal(st.find((x) => x.id === a1.id)?.status, "APPROVED");
          assert.equal(st.find((x) => x.id === a3.id)?.status, "PENDING", "requests after the stop are not touched");
        });

        await t("W8 a person who lost the right between card and press is refused and nothing is written", async () => {
          const { card } = await draw("adjust_leave_quota", { changes: [{ employee: "Admin", type: "SICK", totalDays: 31 }] });
          await asUser(["ai:read"]);
          const r = await press(card);
          assert.equal(r.status, "refused");
          assert.match(r.message, /ไม่มีสิทธิ์/);
          await asUser(["*"]);
          const year = new Date().getFullYear();
          const row = await prisma.leaveBalance.findUnique({ where: { employeeId_year_type: { employeeId: adminId, year, type: "SICK" } }, select: { totalDays: true } });
          assert.notEqual(row?.totalDays, 31);
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 240_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; after the rollback the database is exactly as before: ${clean}`);
  if (!clean) console.log(JSON.stringify({ before, after }));
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
