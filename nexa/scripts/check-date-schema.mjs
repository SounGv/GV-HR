// Checks that form dates reject years that are typing slips (Buddhist era typed as 2569) and keep normal dates working.
// Run: node --experimental-strip-types scripts/check-date-schema.mjs
import assert from "node:assert/strict";
import { calendarDate } from "../src/lib/date-schema.ts";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const s = calendarDate({ message: "กรุณาเลือกวันที่" });

check("a normal date and a date-time pass", () => {
  assert.equal(s.parse("2026-11-18").getUTCFullYear(), 2026);
  assert.equal(s.parse("2026-11-18T09:30:00+07:00").getUTCFullYear(), 2026);
  assert.equal(s.parse("1998-03-05").getUTCFullYear(), 1998);
});
check("a Buddhist-era year is refused with a message naming the cause", () => {
  const r = s.safeParse("2569-10-21");
  assert.equal(r.success, false);
  assert.match(r.error.issues[0].message, /ค\.ศ\./);
});
check("a year outside 1900 to 2100 is refused", () => {
  assert.equal(s.safeParse("1850-01-01").success, false);
  assert.equal(s.safeParse("2101-01-01").success, false);
  assert.equal(s.safeParse("1900-01-01").success, true);
  assert.equal(s.safeParse("2100-12-31").success, true);
});
check("junk and empty input still fail with the field's own message", () => {
  const r = s.safeParse("not a date");
  assert.equal(r.success, false);
  assert.equal(r.error.issues[0].message, "กรุณาเลือกวันที่");
});
check("optional and nullable still work on top of it", () => {
  assert.equal(calendarDate().optional().parse(undefined), undefined);
  assert.equal(calendarDate().nullable().parse(null), null);
});
check("no form schema uses a bare z.coerce.date() any more", () => {
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !p.endsWith("date-schema.ts") && readFileSync(p, "utf8").includes("z.coerce.date(")) hits.push(p);
    }
  };
  walk("src");
  assert.deepEqual(hits, [], "use calendarDate() from @/lib/date-schema");
});
console.log(`${n} checks passed`);
