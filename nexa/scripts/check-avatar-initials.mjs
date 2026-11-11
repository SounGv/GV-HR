// Pure check for avatarInitials(): node --experimental-strip-types scripts/check-avatar-initials.mjs
import assert from "node:assert/strict";
import { avatarInitials } from "../src/lib/format.ts";

assert.equal(avatarInitials("สมชาย ใจดี (ฮอท)"), "ฮอ");
assert.equal(avatarInitials("ณัฐพงษ์ ศรีสุวรรณ์"), "ณัฐ"); // two letters, vowel mark kept with its consonant
assert.equal(avatarInitials("ปู่ เย็น (ปู่)"), "ปู่");
assert.equal(avatarInitials("john smith"), "JO");
assert.equal(avatarInitials("  "), "?");
console.log("avatar initials ok");
