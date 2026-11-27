// Checks how leave days are counted (Monday to Saturday; Sundays skipped) with made-up dates only.
// Run: node --experimental-strip-types scripts/check-leave-days.mjs
import assert from "node:assert/strict";
import {
  MEDICAL_CERT_MESSAGE,
  MEDICAL_CERT_NTH_MESSAGE,
  SICK_USES_WITHOUT_CERT,
  computeLeaveDays,
  countSickUses,
  isSunday,
  medicalCertMessage,
  needsMedicalCertificate,
} from "../src/features/leave/days.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const day = (s) => new Date(`${s}T00:00:00Z`);
// 2030-03-04 is a Monday.
const MON = "2030-03-04";
const FRI = "2030-03-08";
const SAT = "2030-03-09";
const SUN = "2030-03-10";
const NEXT_MON = "2030-03-11";

check("the sample dates are the weekdays the checks assume", () => {
  assert.equal(day(MON).getUTCDay(), 1);
  assert.equal(day(SUN).getUTCDay(), 0);
  assert.equal(isSunday(day(SUN)), true);
  assert.equal(isSunday(day(SAT)), false);
});
check("a single working day counts 1, Saturday included", () => {
  assert.equal(computeLeaveDays(day(MON), day(MON), false), 1);
  assert.equal(computeLeaveDays(day(SAT), day(SAT), false), 1);
});
check("Monday to Saturday counts 6 days", () => {
  assert.equal(computeLeaveDays(day(MON), day(SAT), false), 6);
});
check("a range across a Sunday skips it: Friday to Monday is 3 days, not 4", () => {
  assert.equal(computeLeaveDays(day(FRI), day(NEXT_MON), false), 3);
});
check("a whole week Monday to the next Monday is 7 working days", () => {
  assert.equal(computeLeaveDays(day(MON), day(NEXT_MON), false), 7);
});
check("a request only on a Sunday counts 0 (the caller must reject it)", () => {
  assert.equal(computeLeaveDays(day(SUN), day(SUN), false), 0);
});
check("half a day is 0.5 on a working day and 0 on a Sunday", () => {
  assert.equal(computeLeaveDays(day(MON), day(MON), true), 0.5);
  assert.equal(computeLeaveDays(day(SUN), day(SUN), true), 0);
});
check("a long leave is counted without drifting (30 calendar days = 26 working days here)", () => {
  // 2030-03-04 (Mon) for 30 days ends 2030-04-02; 4 Sundays fall inside (Mar 10, 17, 24, 31).
  assert.equal(computeLeaveDays(day(MON), day("2030-04-02"), false), 26);
});
check("an end date before the start counts 0", () => {
  assert.equal(computeLeaveDays(day(NEXT_MON), day(MON), false), 0);
});

// Sick leave and the medical certificate: the 3rd use of a year onward, or more than 2 days in one request.
const sick = (status, startDate, type = "SICK") => ({ type, status, startDate });
check("the first two uses of sick leave need no certificate, the third does", () => {
  assert.equal(SICK_USES_WITHOUT_CERT, 2);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 1, 0), false);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 1, 1), false);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 1, 2), true);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 1, 5), true);
});
check("the third use needs it even for hourly or half-day sick leave", () => {
  assert.equal(needsMedicalCertificate("SICK", "HOUR", null, 2), true);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 0.5, 2), true);
  assert.equal(needsMedicalCertificate("SICK", "HOUR", null, 1), false);
});
check("the old rule still asks for it: more than 2 days in one request, from the very first use", () => {
  assert.equal(needsMedicalCertificate("SICK", "DAY", 3, 0), true);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 2, 0), false);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 3), true);
});
check("other leave types never need a certificate", () => {
  for (const t of ["ANNUAL", "PERSONAL", "UNPAID", "OTHER"]) assert.equal(needsMedicalCertificate(t, "DAY", 9, 9), false);
});
check("a use is a waiting or approved sick request of that year; rejected, cancelled, other types and other years do not count", () => {
  const list = [
    sick("APPROVED", "2030-01-10"),
    sick("PENDING", "2030-02-10"),
    sick("REJECTED", "2030-03-10"),
    sick("CANCELLED", "2030-04-10"),
    sick("APPROVED", "2030-05-10", "ANNUAL"),
    sick("APPROVED", "2029-12-31"),
    sick("APPROVED", day("2030-12-31")),
  ];
  assert.equal(countSickUses(list, 2030), 3);
  assert.equal(countSickUses(list, 2029), 1);
  assert.equal(countSickUses([], 2030), 0);
});
check("two uses so far means the next request is the third and needs the certificate", () => {
  const uses = countSickUses([sick("APPROVED", "2030-01-10"), sick("PENDING", "2030-02-10")], 2030);
  assert.equal(uses, 2);
  assert.equal(needsMedicalCertificate("SICK", "DAY", 1, uses), true);
});
check("the message says the yearly count once it applies, else the length of the request", () => {
  assert.equal(medicalCertMessage(0), MEDICAL_CERT_MESSAGE);
  assert.equal(medicalCertMessage(1), MEDICAL_CERT_MESSAGE);
  assert.equal(medicalCertMessage(2), MEDICAL_CERT_NTH_MESSAGE);
  assert.ok(MEDICAL_CERT_NTH_MESSAGE.includes("ครั้งที่ 3"));
});

console.log(`\n${n} checks passed`);
