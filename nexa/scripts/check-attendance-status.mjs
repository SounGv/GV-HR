// Checks for the attendance-status rules and the whole-day row cap. No test
// framework is needed; the two files under test have no imports:
//
//   node --experimental-strip-types scripts/check-attendance-status.mjs
//
// Names and numbers here are made up. Exit code 1 when any check fails.
import { classifyToday, excusedUntil, hasPartialLeave, hhmmToMin, watchReasons, watchScore } from "../src/features/attendance-status/status-rules.ts";
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

// ---- approved leave by the hour at the start of the shift (the real case: leave 09:00-10:00, scan at 09:57)
const hr = (a, b) => ({ startMin: hhmmToMin(a), endMin: hhmmToMin(b) });
check("hhmmToMin reads times and refuses nonsense", [hhmmToMin("09:00"), hhmmToMin("9:05"), hhmmToMin("24:00"), hhmmToMin("09:60"), hhmmToMin(null), hhmmToMin("abc")], [540, 545, null, null, null, null]);
check("leave 09:00-10:00 excuses until 10:00", excusedUntil([hr("09:00", "10:00")], 540), 600);
check("leave in the middle of the day does not touch arrival", excusedUntil([hr("13:00", "14:00")], 540), null);
check("leave that already ended before the shift does not count", excusedUntil([hr("07:00", "08:00")], 540), null);
check("leave that begins before the shift and runs into it excuses until its end", excusedUntil([hr("08:00", "10:00")], 540), 600);
check("back to back leaves 09:00-10:00 then 10:00-11:00 excuse until 11:00", excusedUntil([hr("10:00", "11:00"), hr("09:00", "10:00")], 540), 660);
check("a gap between two leaves stops the chain", excusedUntil([hr("09:00", "10:00"), hr("10:30", "11:00")], 540), 600);
check("no leave, nothing excused", excusedUntil([], 540), null);
check("the real case: leave 09:00-10:00 and a scan at 09:57 is normal", classifyToday({ ...base, nowMin: 900, clockInMin: 597, excusedUntilMin: 600 }), "NORMAL");
check("arriving after the leave ends plus grace is late, counted from the end of the leave", classifyToday({ ...base, nowMin: 900, clockInMin: 606, excusedUntilMin: 600 }), "LATE");
check("at the end of the leave plus grace (10:05) is still normal", classifyToday({ ...base, nowMin: 900, clockInMin: 605, excusedUntilMin: 600 }), "NORMAL");
check("without the leave the same 09:57 scan is late", classifyToday({ ...base, nowMin: 900, clockInMin: 597 }), "LATE");
check("no scan during the excused hour is not absent yet", classifyToday({ ...base, nowMin: 620, clockInMin: null, excusedUntilMin: 600 }), "NOT_YET");
check("no scan 30 minutes after the leave ends is absent", classifyToday({ ...base, nowMin: 630, clockInMin: null, excusedUntilMin: 600 }), "ABSENT");

// ---- a person who came in but took an hour or half a day of leave is listed under leave too
check("came in with an hour of leave: listed under leave", hasPartialLeave({ status: "NORMAL", leaveNote: "ลากิจ 09:00-10:00" }), true);
check("came in late with half-day leave: listed under leave", hasPartialLeave({ status: "LATE", leaveNote: "ลาป่วยครึ่งวันเช้า" }), true);
check("on leave all day is already a leave status, not counted twice", hasPartialLeave({ status: "ON_LEAVE", leaveNote: "ลากิจ 09:00-10:00" }), false);
check("no leave note, not listed", hasPartialLeave({ status: "NORMAL", leaveNote: null }), false);

// ---- leave asked for and not answered yet is waiting, not absent
check("no scan, waiting leave request, after the cut-off: LEAVE_PENDING not absent", classifyToday({ ...base, nowMin: 900, clockInMin: null, pendingLeave: true }), "LEAVE_PENDING");
check("no scan, waiting leave request, before the shift: already shown as waiting", classifyToday({ ...base, nowMin: 500, clockInMin: null, pendingLeave: true }), "LEAVE_PENDING");
check("approved leave wins over a waiting one", classifyToday({ ...base, nowMin: 900, clockInMin: null, pendingLeave: true, onApprovedLeave: true }), "ON_LEAVE");
check("scanned in with a waiting request: the scan decides (normal)", classifyToday({ ...base, nowMin: 900, clockInMin: 530, pendingLeave: true }), "NORMAL");
check("scanned late with a waiting request: still late", classifyToday({ ...base, nowMin: 900, clockInMin: 597, pendingLeave: true }), "LATE");
check("request refused or cancelled (no pending flag): absent again", classifyToday({ ...base, nowMin: 900, clockInMin: null, pendingLeave: false }), "ABSENT");

process.exit(failed ? 1 : 0);
