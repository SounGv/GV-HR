// Checks who may read comments copied from Favpo: the anonymity rule and the safe reading of stored JSON.
// Run: node --experimental-strip-types scripts/check-imported-comments.mjs
import assert from "node:assert/strict";
import { ANON_MIN, commentsFor, holdsBackTexts, parseImportedComments } from "../src/features/appraisal-round/imported-comments.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const c = (raterType, raters, texts = ["ดีมาก", "ควรพัฒนา"]) => ({ source: "favpo", raterType, raters, texts });

check("a manager's comments about a person are shown to everyone allowed on the page, whatever the group size", () => {
  const v = commentsFor(c("MANAGER", 1), false);
  assert.equal(v.hidden, false);
  assert.equal(v.texts.length, 2);
});

check("upward comments from fewer than three people are held back for anyone but HR", () => {
  const v = commentsFor(c("SUBORDINATE", ANON_MIN - 1), false);
  assert.equal(v.hidden, true);
  assert.deepEqual(v.texts, []);
  assert.equal(v.hiddenCount, 2);
});

check("upward comments from three or more people are shown", () => {
  const v = commentsFor(c("SUBORDINATE", ANON_MIN), false);
  assert.equal(v.hidden, false);
  assert.equal(v.texts.length, 2);
});

check("HR read everything, even a group of one", () => {
  const v = commentsFor(c("SUBORDINATE", 1), true);
  assert.equal(v.hidden, false);
  assert.equal(v.hiddenCount, 0);
});

check("peers follow the same rule as subordinates", () => {
  assert.equal(commentsFor(c("PEER", 2), false).hidden, true);
  assert.equal(commentsFor(c("PEER", 3), false).hidden, false);
});

check("nothing stored means nothing to show", () => {
  assert.equal(commentsFor(null, true), null);
  assert.equal(parseImportedComments(null), null);
  assert.equal(parseImportedComments(undefined), null);
});

check("stored JSON of the wrong shape is ignored instead of crashing the page", () => {
  assert.equal(parseImportedComments("text"), null);
  assert.equal(parseImportedComments({ raterType: "MANAGER" }), null);
  assert.equal(parseImportedComments({ raterType: "MANAGER", texts: "x" }), null);
  assert.equal(parseImportedComments({ raterType: "MANAGER", texts: [] }), null);
});

check("blank and non-text entries are dropped, the rest kept in order", () => {
  const p = parseImportedComments({ source: "favpo", raterType: "MANAGER", raters: 2, texts: ["ก", "  ", 5, "ข"] });
  assert.deepEqual(p.texts, ["ก", "ข"]);
  assert.equal(p.raters, 2);
});

check("a missing rater count counts as zero, so an upward group is held back rather than shown", () => {
  const p = parseImportedComments({ raterType: "SUBORDINATE", texts: ["ก"] });
  assert.equal(p.raters, 0);
  assert.equal(commentsFor(p, false).hidden, true);
});

check("live answers: a small group of peers or subordinates has its texts held back from managers, never from HR", () => {
  assert.equal(holdsBackTexts("SUBORDINATE", ANON_MIN - 1, false), true);
  assert.equal(holdsBackTexts("PEER", 1, false), true);
  assert.equal(holdsBackTexts("SUBORDINATE", ANON_MIN, false), false);
  assert.equal(holdsBackTexts("SUBORDINATE", 1, true), false);
  assert.equal(holdsBackTexts("MANAGER", 1, false), false);
  assert.equal(holdsBackTexts("SELF", 1, false), false);
});

console.log(`\n${n} checks passed`);
