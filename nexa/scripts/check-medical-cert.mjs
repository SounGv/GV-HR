// node --experimental-strip-types scripts/check-medical-cert.mjs
// Sick leave over 2 days in one request needs a medical certificate (owner, 14 Nov 2026).
import assert from "node:assert/strict";
import { needsMedicalCertificate as need } from "../src/features/leave/days.ts";

assert.equal(need("SICK", "DAY", 1), false);
assert.equal(need("SICK", "DAY", 2), false);
assert.equal(need("SICK", "DAY", 2.5), true);
assert.equal(need("SICK", "DAY", 3), true);
assert.equal(need("SICK", "HOUR", 8), false);
assert.equal(need("PERSONAL", "DAY", 5), false);
assert.equal(need("ANNUAL", "DAY", 5), false);
assert.equal(need("SICK", "DAY", null), false);
console.log("medical-cert: ok");
