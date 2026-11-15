// Things a person using the app would notice at once, checked from the source so they cannot slip back unseen.
//   node scripts/check-ui-invariants.mjs            run the checks
//   node scripts/check-ui-invariants.mjs --update   rewrite the photo baseline (only after fixing files, never to hide one)
//
// 1. The desktop band has a back button on every page except home (it was lost once when the top bar was replaced).
// 2. The word "vercel" is not in any text people read (the address is the one exception, kept in the allowlist).
// 3. Photo ratchet: a file that draws an employee's name must also draw their picture. Files that do not yet are listed in
//    ui-invariants-baseline.json; the list may only shrink. A new file that shows names without pictures fails here.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "scripts", "ui-invariants-baseline.json");
const update = process.argv.includes("--update");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const read = (p) => readFileSync(p, "utf8");
const failures = [];
let passed = 0;
const ok = (name) => { passed++; console.log(`ok  ${name}`); };
const fail = (name, detail) => { failures.push(name); console.log(`FAIL  ${name}\n      ${detail}`); };

// 1. back button in the band
{
  const band = read(join(SRC, "components/layout/section-band.tsx"));
  const hasBack = band.includes("ย้อนกลับ") && /\{!isHome\s*&&\s*\(/.test(band);
  const hidesOnTabs = /isTabPage/.test(band);
  if (hasBack && !hidesOnTabs) ok("the band shows ย้อนกลับ on every page but home");
  else fail("the band shows ย้อนกลับ on every page but home", hasBack ? "the button is hidden on some pages (isTabPage)" : "no ย้อนกลับ button guarded only by !isHome");
}

// 2. no "vercel" in visible text
{
  // The two routes use the address only when the host header is missing. The AI settings page is for administrators and names
  // the tool where they edit variables.
  const allow = new Set(["src/app/api/payroll/send-email/route.ts", "src/app/payslip/[id]/page.tsx", "src/app/(app)/ai/settings/page.tsx"]);
  const bad = [];
  for (const f of files) {
    const r = rel(f);
    if (allow.has(r)) continue;
    const lines = read(f).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/vercel/i.test(line)) return;
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return; // comments
      if (/@vercel\/|process\.env\.VERCEL|VERCEL_[A-Z_]+|x-vercel|vercel\.json|vercel-/i.test(t) && !/["'`>][^"'`<]*vercel[^"'`<]*["'`<]/i.test(t.replace(/process\.env\.VERCEL[A-Z_]*/g, "").replace(/@vercel\/[a-z-]+/g, ""))) return;
      bad.push(`${r}:${i + 1}: ${t.slice(0, 110)}`);
    });
  }
  if (bad.length === 0) ok("no user-visible text mentions vercel");
  else fail("no user-visible text mentions vercel", bad.slice(0, 8).join("\n      "));
}

// 3. photo ratchet
{
  const draws = /\b(displayName|fullName)\(|employee\.(firstName|lastName)|\.firstName\b/;
  const hasPicture = /PersonAvatar|CharacterAvatar|RowFace|PersonFace|FollowRow|AvatarImage|<Avatar\b/;
  const skipDir = /^src\/(lib|app\/api|config|hooks)\//;
  const offenders = files
    .map(rel)
    .filter((r) => r.endsWith(".tsx") && !skipDir.test(r))
    .filter((r) => {
      const text = read(join(ROOT, r));
      return draws.test(text) && !hasPicture.test(text);
    })
    .sort();
  if (update) {
    writeFileSync(BASELINE, JSON.stringify(offenders, null, 1) + "\n");
    console.log(`baseline written: ${offenders.length} files`);
  }
  const baseline = new Set(JSON.parse(read(BASELINE)));
  const added = offenders.filter((r) => !baseline.has(r));
  const fixed = [...baseline].filter((r) => !offenders.includes(r));
  if (added.length === 0) ok(`files that draw a name without a picture: ${offenders.length} (baseline ${baseline.size}${fixed.length ? `, ${fixed.length} fixed: run --update` : ""})`);
  else fail("a file draws an employee's name without their picture", added.join("\n      ") + "\n      Use PersonAvatar (seed = employee id) or PersonFace, or fix the data to carry avatarUrl and gender (faces() in lib/avatar-server.ts).");
}

console.log(`\n${passed} checks passed${failures.length ? `, ${failures.length} failed` : ""}`);
process.exit(failures.length ? 1 : 0);
