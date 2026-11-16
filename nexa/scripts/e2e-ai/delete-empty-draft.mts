/* eslint-disable @typescript-eslint/no-explicit-any -- one-off, confirmed by the owner */
// Deletes ONE empty draft round ("รอบประเมินใหม่", no people, never opened) through the app's own deleteRound (a soft delete with an
// audit row). Dry run first (prints what would change and refuses unless exactly that one round qualifies); pass "apply" to write.
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { deleteRound } from "@/features/appraisal-round/service";

const COMPANY = "00000000-0000-0000-0000-000000000001";
const ID = "a86802a1-ab06-41df-99d4-f03073ab97a1";
(async () => {
  const apply = process.argv[2] === "apply";
  const rounds = await real.appraisalRound.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { id: true, name: true, status: true, isTemplate: true, openedAt: true, createdById: true, _count: { select: { participants: true } } } });
  const target = rounds.find((r) => r.id === ID);
  const assignments = await real.appraisalAssignment.count({ where: { participant: { roundId: ID } } });
  console.log(`rows_in=${rounds.length} matched=${target ? 1 : 0} to_delete=${target ? 1 : 0} skipped=${rounds.length - (target ? 1 : 0)} null_count=0 duplicate_count=${rounds.filter((r) => r.name === "รอบประเมินใหม่").length - 1}`);
  console.table(rounds.map((r) => ({ id: r.id.slice(0, 8), name: r.name.slice(0, 44), status: r.status, template: r.isTemplate, people: r._count.participants, action: r.id === ID ? "DELETE (soft)" : "keep" })));
  assert.ok(target, "the round is not there (already deleted?)");
  assert.equal(target!.name, "รอบประเมินใหม่");
  assert.equal(target!.status, "DRAFT");
  assert.equal(target!.isTemplate, false);
  assert.equal(target!.openedAt, null);
  assert.equal(target!._count.participants, 0);
  assert.equal(assignments, 0);
  assert.equal(rounds.filter((r) => r.name === "รอบประเมินใหม่").length, 1, "another round has the same name");
  if (!apply) { console.log("dry run only: nothing written"); await real.$disconnect(); return; }
  const actor = target!.createdById ? await real.user.findUnique({ where: { id: target!.createdById }, select: { id: true } }) : null;
  assert.ok(actor, "creator account not found");
  const session = { sub: actor!.id, companyId: COMPANY, email: null, username: "admin", roles: [], perms: ["campaign:manage", "campaign:update"] } as any;
  await deleteRound(COMPANY, session, ID);
  const after = await real.appraisalRound.findMany({ where: { companyId: COMPANY }, select: { id: true, deletedAt: true } });
  const gone = after.find((r) => r.id === ID);
  assert.ok(gone?.deletedAt, "read back: deletedAt not set");
  assert.equal(after.filter((r) => !r.deletedAt).length, rounds.length - 1, "other rounds changed");
  const audit = await real.auditLog.findFirst({ where: { entity: "AppraisalRound", entityId: ID, action: "appraisal_round.delete" }, select: { createdAt: true } });
  console.log(`applied: deletedAt=${gone!.deletedAt!.toISOString()} audit_row=${audit ? "yes" : "NO"} active_rounds=${after.filter((r) => !r.deletedAt).length}`);
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
