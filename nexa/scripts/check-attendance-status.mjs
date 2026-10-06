// Checks for the attendance-status rules and the whole-day row cap. No test
// framework is needed; the two files under test have no imports:
//
//   node --experimental-strip-types scripts/check-attendance-status.mjs
//
// Names and numbers here are made up. Exit code 1 when any check fails.
import { classifyToday, watchReasons, watchScore } from "../src/features/attendance-status/status-rules.ts";
import { capRowsByDay, laterDate } from "../src/features/report/daily-cap.ts";

let failed = 0;
const check = (name, got, expected) => {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -> ${JSON.stringify(got)} (expected ${JSON.stringify(expected)})`}`);
};

// ---- today's status (shift starts 09:00 = 540, grace 5 minutes)
const base = { shiftStartMin: 540, lateGraceMin: 5, onApprovedLeave: false };
check("scan at the grace limit (09:05) is normal", classifyToday({ ...base, nowMin: 600, clockInMin: 545 }), "NORMAL");
check("scan one minute later (09:06) is late", classifyToday({ ...base, nowMin: 600, clockInMin: 546 }), "LATE");
check("before the shift, no scan -> not yet", classifyToday({ ...base, nowMin: 500, clockInMin: null }), "NOT_YET");
check("29 minutes after start, no scan -> still not yet", classifyToday({ ...base, nowMin: 569, clockInMin: null }), "NOT_YET");
check("30 minutes after start, no scan -> absent", classifyToday({ ...base, nowMin: 570, clockInMin: null }), "ABSENT");
check("approved leave and no scan -> leave", classifyToday({ ...base, onApprovedLeave: true, nowMin: 700, clockInMin: null }), "ON_LEAVE");
check("approved leave with a late scan (half day) -> normal", classifyToday({ ...base, onApprovedLeave: true, nowMin: 700, clockInMin: 780 }), "NORMAL");
check("shift starting 13:00 is not yet at 12:00", classifyToday({ ...base, shiftStartMin: 780, nowMin: 720, clockInMin: null }), "NOT_YET");
check("shift crossing midnight (starts 22:00) is not yet at 21:00", classifyToday({ ...base, shiftStartMin: 1320, nowMin: 1260, clockInMin: null }), "NOT_YET");
check("custom absent window", classifyToday({ ...base, nowMin: 560, clockInMin: null, absentAfterMin: 15 }), "ABSENT");

// ---- watch list thresholds (late >= 5, absent >= 2, leave >= 4)
check("late 5 qualifies", watchReasons({ late: 5, absent: 0, leave: 0 }), ["late"]);
check("late 4, absent 1, leave 3 does not qualify", watchReasons({ late: 4, absent: 1, leave: 3 }), []);
check("all three reasons", watchReasons({ late: 5, absent: 2, leave: 4 }), ["late", "absent", "leave"]);
check("score weights absent 3, late 2, leave 1", watchScore({ late: 2, absent: 1, leave: 3 }), 10);

// ---- whole-day row cap
const day = (iso, n) => Array.from({ length: n }, () => ({ dateIso: iso }));
const rows = [...day("2026-10-05", 4), ...day("2026-10-02", 4), ...day("2026-10-01", 4)]; // newest first
let r = capRowsByDay(rows, 12);
check("at the limit keeps everything", [r.kept.length, r.truncatedFrom], [12, null]);
r = capRowsByDay(rows, 10);
check("a partly cut oldest day is dropped", [r.kept.length, r.truncatedFrom], [8, "2026-10-02"]);
r = capRowsByDay(rows, 8);
check("a complete boundary day is kept", [r.kept.length, r.truncatedFrom], [8, "2026-10-02"]);
r = capRowsByDay(rows, 1);
check("a limit smaller than one day keeps nothing", [r.kept.length, r.truncatedFrom], [0, "2026-10-06"]);
check("laterDate picks the later, ignoring null", [laterDate(null, "2026-10-02"), laterDate("2026-10-03", "2026-10-02"), laterDate(null, null)], ["2026-10-02", "2026-10-03", null]);

process.exit(failed ? 1 : 0);
