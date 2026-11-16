/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { runQuickAction } from "@/lib/ai/quick";

// The "who took the most leave this year" quick answer against the real database. Read-only: fails if any row count changed.
// Checks the table against a separate sum made here from the same approved requests, and that a refusal comes back for a user without the right.
const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = { l: await real.leaveRequest.count(), a: await real.auditLog.count() };
  const lines: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      lines.push(`PASS  ${name}`);
    } catch (e: any) {
      lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    }
  };
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const claims = (perms: string[]) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms }) as any;

  const year = new Date(Date.now() + 7 * 3600000).getUTCFullYear();
  const rows = await real.leaveRequest.findMany({
    where: { companyId: COMPANY, status: "APPROVED", unit: "DAY", startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) }, employee: { deletedAt: null } },
    select: { employeeId: true, days: true },
  });
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.employeeId, (sums.get(r.employeeId) ?? 0) + r.days);
  const expected = [...sums.values()].sort((a, b) => b - a);

  const res: any = await runQuickAction(claims(["leave:approve", "leave:manage", "leave:read"]), undefined, { action: "leave_ranking", count: 5 });
  await check("HR gets a ranking table of five rows from the real data", async () => {
    assert.ok(res.ok, res.message);
    const table = String(res.markdown).split("\n").filter((l) => /^\| \d+ \|/.test(l));
    assert.equal(table.length, Math.min(5, sums.size));
    lines.push(`      people with approved day leave in ${year}: ${sums.size}; top total ${expected[0] ?? 0}`);
  });
  await check("the totals in the table equal an independent sum, in the same order", async () => {
    const table = String(res.markdown).split("\n").filter((l) => /^\| \d+ \|/.test(l));
    const shown = table.map((l) => Number(l.split("|")[4]!.trim()));
    assert.deepEqual(shown, expected.slice(0, shown.length).map((d) => Math.round(d * 10) / 10));
  });
  await check("the answer says it came from the system and that hourly leave is not counted", async () => {
    assert.ok(String(res.markdown).includes("ไม่ใช้ AI"));
    assert.ok(String(res.markdown).includes("ไม่นับการลารายชั่วโมง"));
  });
  await check("someone without the right to see leave statistics is refused", async () => {
    const no: any = await runQuickAction(claims(["notification:read"]), undefined, { action: "leave_ranking" });
    assert.equal(no.ok, false);
  });
  const after = { l: await real.leaveRequest.count(), a: await real.auditLog.count() };
  await check("nothing was written", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
