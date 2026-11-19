// Checks the pure rules behind the evaluation review fixes: who may see a result, scheduled-round dates and cycle labels.
// Run: node --experimental-strip-types scripts/check-evaluation-fixes.mjs
import assert from "node:assert/strict";
import { canSeeParticipantResult } from "../src/features/campaign/result-visibility.ts";
import { addMonthsClamped, formatCycleLabel } from "../src/features/evaluation-schedule/cycle.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const view = (o) => canSeeParticipantResult({ hrLevel: false, managesTarget: false, own: false, finalized: false, ...o });

check("HR and the person's manager see the result before it is finalized", () => {
  assert.equal(view({ hrLevel: true }), true);
  assert.equal(view({ managesTarget: true }), true);
});
check("the reviewee sees the result only after it is finalized", () => {
  assert.equal(view({ own: true, finalized: false }), false);
  assert.equal(view({ own: true, finalized: true }), true);
});
check("an invited rater never sees the result, finalized or not", () => {
  assert.equal(view({ finalized: false }), false);
  assert.equal(view({ finalized: true }), false);
});

check("adding months clamps to the last day instead of overflowing", () => {
  assert.equal(addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2026-02-28");
  assert.equal(addMonthsClamped(new Date("2028-01-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2028-02-29");
  assert.equal(addMonthsClamped(new Date("2026-08-31T00:00:00Z"), 3).toISOString().slice(0, 10), "2026-11-30");
  assert.equal(addMonthsClamped(new Date("2026-11-15T00:00:00Z"), 3).toISOString().slice(0, 10), "2027-02-15");
  assert.equal(addMonthsClamped(new Date("2026-07-01T00:00:00Z"), 12).toISOString().slice(0, 10), "2027-07-01");
});
check("cycle labels follow the Bangkok month in Buddhist years", () => {
  assert.equal(formatCycleLabel(2026, 7, 6), "ครึ่งปี 2/2569");
  assert.equal(formatCycleLabel(2026, 6, 6), "ครึ่งปี 1/2569");
  assert.equal(formatCycleLabel(2026, 7, 3), "ไตรมาส 3/2569");
  assert.equal(formatCycleLabel(2026, 4, 3), "ไตรมาส 2/2569");
  assert.equal(formatCycleLabel(2026, 1, 12), "ประจำปี 2569");
  assert.equal(formatCycleLabel(2026, 11, 1), "เดือน 11/2569");
});

console.log(`\n${n} checks passed`);
