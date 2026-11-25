// Read-only audit of faint text: (A) the colour tokens in globals.css as foreground/background pairs, light and dark,
// and (B) text colours written in the code (Tailwind greys, fades such as text-white/60, raw hex, small grey text).
// Run: node scripts/audit-contrast.mjs        Writes nothing. Exit code 1 when a token pair is under 4.5:1.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

// ---------- colour maths
const hex = (s) => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim()); if (!m) return null; let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));

// ---------- A. tokens
function block(selector) {
  const out = {};
  const re = new RegExp("(?:^|\\n)" + selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{", "g");
  while (re.exec(css)) {
    let i = re.lastIndex, depth = 1;
    while (i < css.length && depth) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; }
    for (const t of css.slice(re.lastIndex, i).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[t[1]] = t[2];
  }
  return out;
}
const light = { ...block(":root"), ...block(".theme-flip7") };
// In dark mode the page scope (.theme-flip7) applies its light rule too and ".dark .theme-flip7" can undo it; --muted-strong is an alias.
const dark = { ...block(":root"), ...block(".dark"), ...block(".theme-flip7"), ...block(".dark .theme-flip7") };
dark["muted-strong"] = dark["muted-foreground"];
const resolve = (theme, name) => { let v = theme[name]; return v ? hex(v) : null; };
const PAIRS = [
  ["foreground", "background"], ["foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "muted"],
  ["muted-strong", "card"], ["muted-strong", "muted"], ["primary", "card"], ["primary", "background"], ["primary-foreground", "primary"], ["destructive", "card"],
  ["menu-inactive-fg", "card"], ["menu-active-fg", "menu-active-bg"], ["sidebar-foreground", "sidebar"], ["sidebar-primary-foreground", "sidebar-primary"],
  ["status-normal-fg", "status-normal-bg"], ["status-late-fg", "status-late-bg"], ["status-absent-fg", "status-absent-bg"], ["status-leave-fg", "status-leave-bg"],
  ["status-notyet-fg", "status-notyet-bg"], ["status-pending-fg", "status-pending-bg"], ["leave-sick-fg", "leave-sick-bg"], ["on-hero-accent-fg", "on-hero-accent"],
  ["ticker-warn-fg", "ticker-warn"],
];
const bad = [];
const lines = [];
for (const [themeName, theme] of [["สว่าง", light], ["มืด", dark]]) {
  for (const [f, b] of PAIRS) {
    const fa = resolve(theme, f), ba = resolve(theme, b);
    if (!fa || !ba) continue;
    const r = ratio(fa, ba);
    lines.push(`${r >= 4.5 ? "ok   " : "LOW  "} ${themeName.padEnd(5)} ${f} บน ${b}: ${r.toFixed(2)}`);
    if (r < 4.5) bad.push(`token ${themeName} ${f}/${b} = ${r.toFixed(2)}`);
  }
  // borders of fields should reach 3:1 against the card
  const bd = resolve(theme, "field-border"), cd = resolve(theme, "card");
  if (bd && cd) { const r = ratio(bd, cd); lines.push(`${r >= 3 ? "ok   " : "LOW  "} ${themeName.padEnd(5)} ขอบช่องกรอก (input) บน card: ${r.toFixed(2)} (ต้องการ 3.0)`); if (r < 3) bad.push(`field border ${themeName} = ${r.toFixed(2)}`); }
}

// ---------- B. colours written in code
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, o); else o.push(p); } return o; };
const files = walk(path.join(ROOT, "src")).filter((f) => /\.tsx$/.test(f));
const PAL = { gray: { 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280" }, slate: { 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b" }, zinc: { 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a" }, neutral: { 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373" }, stone: { 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c" } };
const WHITE = [255, 255, 255];
const DARKHINT = /gv-hero|gv-teal-surface|bg-\[#(0|1)[0-9a-f]{5}\]|bg-sidebar\b|bg-primary\b|bg-foreground|bg-black|bg-slate-9|bg-gray-9|gv-glass|text-white|bg-\[linear-gradient|from-\[#|dark:/;
// Cards that are dark on purpose (check-in card, auth brand panel, payroll banners): light grey text on them is right.
const DARKFILES = /auth-brand-panel|\(auth\)|mobile-checkin-flow|clock-card|integration-hub|self-profile-form|payroll-view|mobile-payslips-view|company-profile-form/;
const found = { greyUtil: [], fade: [], whiteFade: [], hex: [], tiny: [], opacityText: [] };
for (const f of files) {
  const rel = path.relative(ROOT, f).replaceAll("\\", "/");
  read: {
    const src = fs.readFileSync(f, "utf8").split("\n");
    src.forEach((line, i) => {
      const at = `${rel}:${i + 1}`;
      for (const m of DARKFILES.test(rel) ? [] : line.matchAll(/(?<![-\w])text-(gray|slate|zinc|neutral|stone)-(300|400|500)\b/g)) {
        const r = ratio(hex(PAL[m[1]][m[2]]), WHITE);
        if (r < 4.5 && !/dark:text-/.test(line)) found.greyUtil.push(`${at} ${m[0]} = ${r.toFixed(2)}`);
      }
      for (const m of line.matchAll(/(?<![-\w])text-(muted-foreground|foreground)\/(\d{1,2})\b/g)) {
        const a = Number(m[2]) / 100, fg = hex(m[1] === "foreground" ? light.foreground : light["muted-foreground"]);
        const r = ratio(over(fg, WHITE, a), WHITE);
        if (r < 4.5) found.fade.push(`${at} ${m[0]} = ${r.toFixed(2)} บนขาว`);
      }
      for (const m of line.matchAll(/(?<![-\w])text-white\/(\d{1,2})\b/g)) {
        const a = Number(m[1]) / 100;
        // worst case: the lightest teal the hero uses
        const r = ratio(over(WHITE, hex("#0f766e"), a), hex("#0f766e"));
        if (r < 4.5) found.whiteFade.push(`${at} ${m[0]} = ${r.toFixed(2)} บนเขียวกลาง #0f766e`);
      }
      if (!DARKHINT.test(line) && !DARKFILES.test(rel) && !/size-\d/.test(line)) {
        for (const m of line.matchAll(/(?<![-\w])text-\[(#[0-9a-fA-F]{3,6})\]/g)) {
          const c = hex(m[1]); if (!c) continue;
          const r = ratio(c, WHITE);
          if (r < 4.5) found.hex.push(`${at} ${m[0]} = ${r.toFixed(2)} บนขาว`);
        }
        for (const m of line.matchAll(/color:\s*["'](#[0-9a-fA-F]{3,6})["']/g)) {
          const c = hex(m[1]); if (!c) continue;
          const r = ratio(c, WHITE);
          if (r < 4.5) found.hex.push(`${at} color:${m[1]} = ${r.toFixed(2)} บนขาว`);
        }
      }
      if (/text-\[(9|10|11)(\.\d)?px\]/.test(line) && /text-muted-foreground|text-gray|text-slate/.test(line)) found.tiny.push(`${at} ตัวอักษรเล็กกว่า 12px สีเทา`);
      if (/(?<![-\w])(opacity-(30|40|50|60|70))\b/.test(line) && /(?<![-\w])text-/.test(line) && !/disabled|hover:|group-hover|peer-/.test(line)) found.opacityText.push(`${at} ${line.trim().slice(0, 100)}`);
    });
  }
}

const sec = (title, arr, n = 14) => { console.log(`\n== ${title}: ${arr.length}`); arr.slice(0, n).forEach((x) => console.log("  " + x)); if (arr.length > n) console.log(`  ... อีก ${arr.length - n}`); };
console.log("== คู่สีใน globals.css (ต้องการ 4.5 สำหรับตัวอักษร)");
console.log(lines.filter((l) => l.startsWith("LOW")).join("\n") || "  ทุกคู่ผ่าน 4.5");
console.log(`  (ตรวจ ${lines.length} คู่ ผ่าน ${lines.filter((l) => l.startsWith("ok")).length})`);
sec("สีเทาของ Tailwind ที่จางกว่า 4.5 บนขาว", found.greyUtil);
sec("text-muted-foreground/xx หรือ text-foreground/xx ที่ลดความเข้ม", found.fade);
sec("text-white/xx ที่จางเกินบนพื้นเขียว", found.whiteFade, 30);
sec("สี hex เขียนตรงๆ ที่จางกว่า 4.5 บนขาว", found.hex);
sec("ตัวอักษรเล็กกว่า 12px สีเทา", found.tiny);
sec("ตัวอักษรที่ใส่ opacity-30 ถึง 70", found.opacityText);
process.exit(bad.length ? 1 : 0);
