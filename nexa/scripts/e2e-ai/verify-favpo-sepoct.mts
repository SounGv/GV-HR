/* eslint-disable @typescript-eslint/no-explicit-any -- read-only read-back */
// Read-back after the September/October import: compares every line of the four Favpo files with what is in the database
// (sheet by sheet: score, date, comment), and checks the counts and the state of the rounds. Writes nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma as real } from "@real/prisma";

const COMPANY = "00000000-0000-0000-0000-000000000001";
const norm = (s: string) => s.replace(/[\s​ ]+/g, "");
const FILES = [
  { file: "r2246.txt", name: "กันยายน 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", type: "MANAGER", all: true },
  { file: "r2247.txt", name: "กันยายน 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", type: "SUBORDINATE", all: true },
  { file: "r2268.txt", name: "ตุลาคม 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", type: "MANAGER", all: false },
  { file: "r2269.txt", name: "ตุลาคม 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", type: "SUBORDINATE", all: false },
];
(async () => {
  const dir = process.argv[2]!;
  const names = readFileSync(join(dir, "names.txt"), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
  const emps = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { id: true, firstName: true, lastName: true, nickname: true } });
  const find = (n: string) => {
    let c = emps.filter((e) => norm(`${e.firstName}${e.lastName ?? ""}`) === norm(n));
    if (c.length === 0) c = emps.filter((e) => norm(e.firstName) === norm(n) || (e.nickname && norm(e.nickname) === norm(n) && !e.lastName));
    return c.length === 1 ? c[0]!.id : null;
  };
  const out: string[] = [];
  const ok = (good: boolean, msg: string) => out.push(`${good ? "OK   " : "CHECK"} ${msg}`);

  const textQ = await real.appraisalQuestion.findFirst({ where: { answerType: "PARAGRAPH", form: { name: "แบบประเมิน 2026 New (นำเข้าจาก Favpo)" } }, select: { id: true } });
  ok(!!textQ, "the archived Favpo form has the suggestion question");
  for (const f of FILES) {
    const round = await real.appraisalRound.findFirst({
      where: { companyId: COMPANY, name: f.name, deletedAt: null },
      select: { id: true, status: true, participants: { select: { id: true, resultStatus: true, scorePercent: true, importedComments: true, employeeId: true, assignments: { select: { raterEmployeeId: true, raterType: true, status: true, answers: true, submittedAt: true } } } } },
    });
    ok(!!round && round.status === "CLOSED", `${f.name.slice(0, 30)}: round exists and is closed`);
    if (!round) continue;
    const lines = readFileSync(join(dir, f.file), "utf8").replace(/\r?\n$/, "").split(/\r?\n/).filter(Boolean);
    let matched = 0, scoreBad = 0, commentBad = 0, dateBad = 0, notFound = 0, skippedUnmatched = 0, commentCount = 0;
    for (const l of lines) {
      const [a, b, pct, ddmm, ...rest] = l.split("|");
      const ratee = find(names[parseInt(a!, 36)]!), rater = find(names[parseInt(b!, 36)]!);
      const comment = rest.join("|").trim();
      if (!ratee || !rater) { skippedUnmatched++; continue; }
      const p = round.participants.find((x) => x.employeeId === ratee);
      const sheet = p?.assignments.find((x) => x.raterEmployeeId === rater && x.raterType === f.type);
      if (!sheet) { notFound++; continue; }
      matched++;
      const ans: any[] = Array.isArray(sheet.answers) ? (sheet.answers as any[]) : [];
      const text = ans.find((x) => x.questionId === textQ?.id)?.value ?? "";
      if (comment) commentCount++;
      if (text !== comment) commentBad++;
      if (f.all) {
        const score = ans.find((x) => x.questionId !== textQ?.id)?.value;
        if (score !== Math.round((Number(pct) / 100) * 3)) scoreBad++;
        const day = Number(ddmm!.slice(0, 2)), month = Number(ddmm!.slice(2));
        if (sheet.submittedAt?.toISOString() !== new Date(Date.UTC(2026, month - 1, day, 5)).toISOString() || sheet.status !== "SUBMITTED") dateBad++;
      }
    }
    ok(notFound === 0 && commentBad === 0 && scoreBad === 0 && dateBad === 0, `${f.name.slice(0, 30)}: ${lines.length} lines, ${matched} sheets compared (${commentCount} comments), sheet missing ${notFound}, comment differs ${commentBad}, score differs ${scoreBad}, date differs ${dateBad}, not matched to an employee ${skippedUnmatched}`);
    const allSheets = round.participants.flatMap((p) => p.assignments);
    const withText = allSheets.filter((a) => (Array.isArray(a.answers) ? (a.answers as any[]) : []).some((x) => x.questionId === textQ?.id && x.value)).length;
    ok(true, `${f.name.slice(0, 30)}: ${round.participants.length} people, ${allSheets.length} sheets, ${withText} with a comment, anonymous list left on ${round.participants.filter((p) => p.importedComments).length} people, results ${[...new Set(round.participants.map((p) => p.resultStatus))].join("/")}`);
    if (f.all) {
      const bad = round.participants.filter((p) => {
        const sc = p.assignments.map((a) => ((a.answers as any[]).find((x) => x.questionId !== textQ?.id)?.value ?? 0) as number);
        if (!sc.length) return true;
        return Math.abs((sc.reduce((s, v) => s + v, 0) / sc.length / 3) * 100 - (p.scorePercent ?? -1)) > 0.02;
      }).length;
      ok(bad === 0, `${f.name.slice(0, 30)}: the stored score of each person equals the average of that person's sheets (${bad} differ)`);
    }
  }
  const dupes = await real.appraisalAssignment.groupBy({ by: ["participantId", "raterEmployeeId", "raterType"], _count: { _all: true }, having: { raterEmployeeId: { _count: { gt: 1 } } } });
  ok(dupes.length === 0, "no rater has two sheets for the same person");
  const notif = await real.notification.count({ where: { createdAt: { gte: new Date(Date.now() - 3600_000) }, OR: [{ title: { contains: "ประเมิน" } }, { body: { contains: "ประเมิน" } }] } });
  ok(notif === 0, `no evaluation notification was created in the last hour (${notif})`);
  const rounds = await real.appraisalRound.count({ where: { companyId: COMPANY, deletedAt: null } });
  ok(rounds === 6, `active rounds: ${rounds} (2 templates, 2 September, 2 October)`);
  console.log(out.join("\n"));
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
