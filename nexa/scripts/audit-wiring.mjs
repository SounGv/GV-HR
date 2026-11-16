// Read-only static audit of how the app is wired: menu links, page links, client API calls, permission keys, cron jobs.
// Run: node --experimental-strip-types scripts/audit-wiring.mjs   (writes nothing, touches no database)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = walk(SRC);
const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");
const read = (p) => fs.readFileSync(p, "utf8");
const problems = [];
const info = [];
const bad = (area, msg) => problems.push(`${area}: ${msg}`);

// ---- pages and API routes -> patterns
const toPattern = (route) =>
  new RegExp("^" + route.split("/").map((s) => (/^\[\.\.\..+\]$/.test(s) ? ".+" : /^\[.+\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/") + "/?$");
const routeOf = (f, base) =>
  "/" + path.relative(base, path.dirname(f)).replaceAll("\\", "/").split("/").filter((s) => s && !/^\(.+\)$/.test(s)).join("/");
const appDir = path.join(SRC, "app");
const pages = files.filter((f) => f.endsWith("/page.tsx") || f.endsWith("\\page.tsx")).map((f) => ({ f, route: routeOf(f, appDir) === "/" ? "/" : routeOf(f, appDir).replace(/\/$/, "") }));
const apis = files.filter((f) => /[\\/]route\.ts$/.test(f)).map((f) => ({ f, route: routeOf(f, appDir), src: read(f) }));
for (const p of pages) p.re = toPattern(p.route === "" ? "/" : p.route);
for (const a of apis) a.re = toPattern(a.route);
const pageFor = (href) => pages.find((p) => p.re.test(href === "" ? "/" : href));
const apiFor = (href) => apis.find((a) => a.re.test(href));

// ---- B. every menu link has a page
const nav = read(path.join(SRC, "config/navigation.ts"));
const navHrefs = [...nav.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
for (const h of new Set(navHrefs)) {
  const clean = h.split("?")[0].split("#")[0];
  if (!/^\//.test(clean)) continue;
  if (!pageFor(clean)) bad("menu", `link ${h} has no page`);
}
const notReady = [...nav.matchAll(/ready:\s*false/g)].length;
info.push(`menu: ${new Set(navHrefs).size} distinct links, ${notReady} marked not ready`);

// ---- C. literal links inside the code
let linkCount = 0;
const isCode = (f) => /\.(tsx|ts)$/.test(f) && !/[\\/]scripts[\\/]/.test(f);
for (const f of files.filter(isCode)) {
  const s = read(f);
  for (const m of s.matchAll(/(?:href|redirect|router\.(?:push|replace)|backHref|permanentRedirect)\s*(?:=|\()\s*\{?\s*[`"'](\/[^`"'$ {?#]*)(?:[?#][^`"']*)?[`"']/g)) {
    const h = m[1];
    if (/^\/(api|_next|uploads|favicon|gv-|characters|manifest|sw\.js)/.test(h) || /\.[a-z0-9]{2,4}$/i.test(h)) continue;
    linkCount++;
    if (!pageFor(h.replace(/\/$/, "") || "/")) bad("link", `${rel(f)}: ${h} has no page`);
  }
}
info.push(`links: ${linkCount} literal page links checked`);

// A template like /api/x${qs} ends where the placeholder starts; a placeholder after a slash is a path segment.
const cleanUrl = (raw) => {
  let u = raw;
  const i = u.indexOf("${");
  if (i >= 0 && !(u[i - 1] === "/")) u = u.slice(0, i);
  return u.split("?")[0].replace(/\$\{[^}]*\}/g, "x").replace(/\/$/, "") || "/";
};

// ---- D. client API calls reach a route that exports the method
const verbs = { get: "GET", post: "POST", patch: "PATCH", put: "PUT", delete: "DELETE" };
let apiCalls = 0;
const usedApis = new Set();
for (const f of files.filter(isCode)) {
  const s = read(f);
  for (const m of s.matchAll(/\bapi\.(get|post|patch|put|delete)\s*(?:<[^()]*?>)?\s*\(\s*([`"'])(\/api\/[^`"']*)\2/g)) {
    let u = cleanUrl(m[3]);
    apiCalls++;
    const a = apiFor(u);
    if (!a) { bad("api", `${rel(f)}: ${m[1].toUpperCase()} ${u} has no route`); continue; }
    usedApis.add(a.f);
    if (!new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${verbs[m[1]]}\\b|export\\s*\\{[^}]*\\b${verbs[m[1]]}\\b`).test(a.src)) bad("api", `${rel(f)}: ${u} route does not export ${verbs[m[1]]}`);
  }
}
info.push(`api: ${apiCalls} client calls checked against ${apis.length} routes`);
// raw fetch("/api/...")
for (const f of files.filter(isCode)) {
  for (const m of read(f).matchAll(/fetch\(\s*([`"'])(\/api\/[^`"']*)\1/g)) {
    const u = cleanUrl(m[2]);
    const a = apiFor(u);
    if (!a) bad("api", `${rel(f)}: fetch ${u} has no route`); else usedApis.add(a.f);
  }
}

// ---- E. permission keys used in code exist in the catalog
const perms = await import(pathToUrl(path.join(SRC, "config/permissions.ts")));
function pathToUrl(p) { return "file:///" + p.replaceAll("\\", "/"); }
const known = new Set();
for (const m of perms.MODULES) for (const a of m.actions) known.add(`${m.key}:${a}`);
const usedPerm = new Map();
for (const f of files.filter(isCode)) {
  if (rel(f).endsWith("config/permissions.ts")) continue;
  const s = read(f);
  for (const m of s.matchAll(/(?:can|hasPermission|requirePermission|requireAnyPermission|requirePageAnyPermission|requirePagePermission|permission|perm|permissions|requireAll)\s*[:(]\s*\[?\s*[`"']([a-z][a-z-]*:[a-z]+)[`"']/g)) {
    usedPerm.set(m[1], [...(usedPerm.get(m[1]) ?? []), rel(f)]);
  }
  for (const m of s.matchAll(/\[\s*(?:[`"'][a-z][a-z-]*:[a-z]+[`"']\s*,?\s*)+\]/g)) {
    for (const k of m[0].matchAll(/[`"']([a-z][a-z-]*:[a-z]+)[`"']/g)) usedPerm.set(k[1], [...(usedPerm.get(k[1]) ?? []), rel(f)]);
  }
}
for (const [k, where] of usedPerm) {
  if (!known.has(k) && !/^(http|https|text|image|application|data|mailto|tel)$/.test(k.split(":")[0])) bad("permission", `"${k}" is used (${[...new Set(where)].slice(0, 2).join(", ")}) but is not in the catalog`);
}
info.push(`permissions: ${usedPerm.size} keys used in code, ${known.size} in the catalog`);

// ---- F. cron jobs
const vercel = JSON.parse(read(path.join(ROOT, "vercel.json")));
for (const c of vercel.crons ?? []) {
  const a = apiFor(c.path);
  if (!a) bad("cron", `${c.path} has no route`);
  else if (!/CRON_SECRET/.test(a.src)) bad("cron", `${c.path} does not check CRON_SECRET`);
}
info.push(`cron: ${(vercel.crons ?? []).length} jobs in vercel.json`);

// ---- G/H. unreferenced pages and routes (information only)
const allText = files.filter(isCode).map(read).join("\n");
const unlinkedPages = pages.filter((p) => {
  if (p.route === "/" || /\/(login|register|forgot|reset)/.test(p.route)) return false;
  const stem = p.route.replace(/\[[^\]]+\]/g, "");
  return !allText.includes(`"${p.route}"`) && !allText.includes(`\`${stem}`) && !allText.includes(`"${stem}`) && !allText.includes(`'${stem}`);
});
info.push(`pages never linked to by their path (${unlinkedPages.length}): ${unlinkedPages.map((p) => p.route).slice(0, 25).join(" ")}`);
const unusedApis = apis.filter((a) => !usedApis.has(a.f) && !/\/api\/(cron|auth|integrations)\b/.test(a.route));
info.push(`API routes no client code calls through api.* or fetch (${unusedApis.length}): ${unusedApis.map((a) => a.route).slice(0, 25).join(" ")}`);

console.log(info.join("\n"));
console.log(problems.length ? `\n${problems.length} PROBLEMS\n` + problems.join("\n") : "\nNO PROBLEMS in menu, links, client API calls, permission keys or cron jobs");
process.exit(problems.length ? 1 : 0);
