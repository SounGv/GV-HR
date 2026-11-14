// Checks the confirmation cards น้องวีบอท draws and the signed token behind them, with made-up data only.
// Run: node --experimental-strip-types scripts/check-ai-proposal.mjs
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import {
  buildAnnouncementCard,
  buildNotificationCard,
  checkProposalInput,
  isAllTarget,
  PROPOSAL_LIMITS,
  PROPOSAL_TOOL_RESULT,
  recipientsText,
} from "../src/features/ai/proposal.ts";
import { signAiProposalToken, verifyAiProposalToken } from "../src/lib/auth/jwt.ts";

let n = 0;
const check = async (name, fn) => {
  await fn();
  n++;
  console.log(`ok  ${name}`);
};

await check("a notification needs a target, a title and a body", () => {
  assert.equal(checkProposalInput("send_notification", { title: "a", body: "b" }).ok, false);
  assert.equal(checkProposalInput("send_notification", { target: "all", body: "b" }).ok, false);
  assert.equal(checkProposalInput("send_notification", { target: "all", title: "a" }).ok, false);
  const r = checkProposalInput("send_notification", { target: " all ", title: " a ", body: " b " });
  assert.deepEqual(r, { ok: true, title: "a", body: "b", target: "all" });
});
await check("an announcement needs only a title and a body, and trims them", () => {
  assert.equal(checkProposalInput("create_announcement", { title: "a" }).ok, false);
  assert.deepEqual(checkProposalInput("create_announcement", { title: " a ", body: " b " }), { ok: true, title: "a", body: "b" });
});
await check("limits match the announcement form (200 / 5000) and are refused with Thai text the model can relay", () => {
  const long = checkProposalInput("create_announcement", { title: "x".repeat(PROPOSAL_LIMITS.title + 1), body: "b" });
  assert.equal(long.ok, false);
  assert.match(long.message, /หัวข้อยาวเกิน 200/);
  assert.equal(checkProposalInput("create_announcement", { title: "t", body: "x".repeat(PROPOSAL_LIMITS.body + 1) }).ok, false);
  assert.equal(checkProposalInput("create_announcement", { title: "x".repeat(200), body: "x".repeat(5000) }).ok, true);
});
await check("non-string input from the model is treated as missing, never coerced", () => {
  assert.equal(checkProposalInput("create_announcement", { title: 123, body: { a: 1 } }).ok, false);
});
await check("'all' is recognised however it is cased or padded", () => {
  assert.equal(isAllTarget(" ALL "), true);
  assert.equal(isAllTarget("alliance"), false);
  assert.equal(isAllTarget(undefined), false);
});
await check("recipients read naturally for one person, a few and many", () => {
  assert.equal(recipientsText(1, ["สมชาย (ตัวอย่าง)"], false), "สมชาย (ตัวอย่าง)");
  assert.equal(recipientsText(3, ["ก", "ข", "ค"], false), "3 คน: ก, ข, ค");
  assert.match(recipientsText(8, ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ"], false), /^8 คน เช่น ก, ข, ค, ง, จ$/);
  assert.match(recipientsText(87, [], true), /^87 คน/);
});
await check("the notification card puts the count on the button and warns that sending cannot be undone", () => {
  const c = buildNotificationCard("tok", { title: "ปิดระบบ", body: "20:00" }, { count: 87, names: [], isAll: true });
  assert.equal(c.confirmLabel, "ยืนยัน ส่งถึง 87 คน");
  assert.equal(c.doneText, "ส่งแจ้งเตือนแล้ว ถึง 87 คน");
  assert.match(c.note, /เรียกคืนไม่ได้/);
  assert.equal(c.kind, "send_notification");
  assert.ok(c.rows.some((r) => r.value.includes("ไม่ส่ง LINE")));
});
await check("the announcement card shows who signs and how many people it reaches", () => {
  const c = buildAnnouncementCard("tok", { title: "หยุดชดเชย", body: "5 ธ.ค." }, "ผู้ทดสอบ (ตัวอย่าง)", 87);
  assert.ok(c.rows.some((r) => r.label === "ผู้ลงชื่อ" && r.value === "ผู้ทดสอบ (ตัวอย่าง)"));
  assert.ok(c.rows.some((r) => r.value.includes("87")));
  assert.equal(c.confirmLabel, "ยืนยัน เผยแพร่ประกาศ");
});
await check("the model is told nothing was sent and not to ask again in text", () => {
  assert.match(PROPOSAL_TOOL_RESULT, /ยังไม่ได้ส่งหรือเผยแพร่/);
  assert.match(PROPOSAL_TOOL_RESULT, /ห้ามบอกว่าส่งหรือเผยแพร่เสร็จแล้ว/);
});

process.env.JWT_ACCESS_SECRET = "test-secret-for-check-only";
await check("a signed card verifies and carries its payload, the person and the issue time", async () => {
  const t = await signAiProposalToken("user-1", "co-1", { kind: "create_announcement", title: "a", body: "b", count: 3 });
  const v = await verifyAiProposalToken(t);
  assert.equal(v.sub, "user-1");
  assert.equal(v.companyId, "co-1");
  assert.equal(v.payload.count, 3);
  assert.ok(Math.abs(v.iat - Date.now() / 1000) < 5);
});
await check("a changed token is refused", async () => {
  const t = await signAiProposalToken("user-1", "co-1", { kind: "send_notification", title: "a", body: "b" });
  const [h, p, s] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), sub: "user-2" })).toString("base64url");
  assert.equal(await verifyAiProposalToken(`${h}.${forged}.${s}`), null);
  assert.equal(await verifyAiProposalToken("not-a-token"), null);
});
await check("a token signed with a different key is refused", async () => {
  const other = await new SignJWT({ purpose: "ai-proposal", companyId: "co-1", p: { kind: "create_announcement" } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject("user-1")
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode("another-secret"));
  assert.equal(await verifyAiProposalToken(other), null);
});
await check("a login-style token (same key, other purpose) cannot be used as a card", async () => {
  const mfa = await new SignJWT({ purpose: "mfa", companyId: "co-1", p: {} })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject("user-1")
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  assert.equal(await verifyAiProposalToken(mfa), null);
});
await check("an expired card is refused", async () => {
  const old = await new SignJWT({ purpose: "ai-proposal", companyId: "co-1", p: { kind: "create_announcement" } })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setSubject("user-1")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  assert.equal(await verifyAiProposalToken(old), null);
});

console.log(`\n${n} checks passed`);
