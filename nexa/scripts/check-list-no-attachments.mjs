// Lists of leave, loan and expense requests must not carry the attachment file: it is an inline base64 file of up to
// 3 MB, lists hold up to 200 rows and the nav badge polls one, and Vercel refuses a response over about 4.5 MB.
// Run: node scripts/check-list-no-attachments.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

/** The text of `const <name> = { ... }` up to its closing brace at column 0 or `} satisfies`. */
function selectBlock(file, name) {
  const text = readFileSync(file, "utf8");
  const start = text.indexOf(`const ${name} = {`);
  assert.ok(start >= 0, `${file}: const ${name} not found`);
  const end = text.indexOf("satisfies", start);
  return text.slice(start, end);
}

const cases = [
  ["src/features/leave/service.ts", "requestListSelect", "attachmentUrl"],
  ["src/features/company-loan/service.ts", "loanListSelect", "attachmentUrl"],
  ["src/features/expense/service.ts", "claimListSelect", "receiptUrl"],
];
for (const [file, name, field] of cases) {
  check(`${name} leaves out ${field}`, () => assert.ok(!selectBlock(file, name).includes(field)));
}

check("the list functions read the list select, not the full one", () => {
  const leave = readFileSync("src/features/leave/service.ts", "utf8");
  const loan = readFileSync("src/features/company-loan/service.ts", "utf8");
  const expense = readFileSync("src/features/expense/service.ts", "utf8");
  const body = (text, fn) => text.slice(text.indexOf(`export async function ${fn}`), text.indexOf("export async function", text.indexOf(`export async function ${fn}`) + 10));
  assert.match(body(leave, "listLeave"), /select: requestListSelect/);
  assert.match(body(loan, "listLoans"), /select: loanListSelect/);
  assert.match(body(expense, "listExpenses"), /select: claimListSelect/);
});

check("the medical benefits report does not read the receipt files", () => {
  const text = readFileSync("src/features/benefits/report-service.ts", "utf8");
  assert.ok(!/receiptUrl:\s*true/.test(text), "the report must count receipts in the database, not select them");
});
console.log(`${n} checks passed`);
