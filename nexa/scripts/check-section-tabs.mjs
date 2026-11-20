// Checks which group a page belongs to and the tabs shown for it.
// Run: node --experimental-strip-types scripts/check-section-tabs.mjs
import assert from "node:assert/strict";
import { bestMatchHref, entriesOf, groupTabs, resolveSection } from "../src/config/section-tabs.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const it = (label, href, permission = "x:read", extra = {}) => ({ label, href, permission, ...extra });
const GROUPS = [
  { label: "ภาพรวม", items: [it("หน้าหลัก", "/dashboard"), it("AI Assistant", "/ai", "ai:read", { opensAiPanel: true, featured: true }), it("แจ้งเตือน", "/notifications", "x:read", { badgeKey: "unreadNotifications" })] },
  { label: "เวลาทำงาน", items: [it("เข้างาน / ออกงาน", "/attendance"), it("แก้ไขเวลาเข้า-ออกงาน", "/attendance/corrections"), it("กะการทำงาน", "/shifts"), it("มาสาย / ขาดงาน", "/reports?view=attendance_daily")] },
  { label: "การลาและคำขอ", items: [it("คำขอรออนุมัติ", "/requests?view=approvals", "x:read", { badgeKey: "pendingApprovals" }), it("ประวัติการลา", "/leave")] },
  { label: "พนักงาน", items: [it("รายชื่อพนักงาน", "/employees", "employee:read"), it("แผนกและตำแหน่ง", "/organization?tab=departments", "employee:read"), it("โครงสร้างองค์กร", "/organization?tab=chart", "employee:read")] },
  { label: "ประเมินและพัฒนา", items: [it("งานประเมินของฉัน", "/appraisal/tasks", "n:read", { badgeKey: "pendingReviews" }), it("ผลประเมินของฉัน", "/appraisal/my-results", "n:read"), it("จัดการประเมิน", "/appraisal", "campaign:manage"), it("อบรมและพัฒนา", "/training", "training:read")] },
  { label: "รายงานและสื่อสาร", items: [it("รายงานการลา", "/reports?view=leave"), it("รายงานและวิเคราะห์ทั้งหมด", "/reports"), it("ประกาศและแจ้งเตือน", "/announcements")] },
  { label: "ข้อมูลระบบ", items: [it("นำเข้าข้อมูล", "/import", "import:read")] },
  { label: "ระบบ", items: [it("ออกจากระบบ", "#", "x:read", { isLogout: true }), it("ผู้ดูแลระบบ", "/admin", "admin:read")] },
];
const all = () => true;
const only = (...keys) => (p) => p === "x:read" || keys.includes(p);
const at = (pathname, canSee = all, search = {}) => resolveSection(GROUPS, canSee, pathname, { get: (k) => search[k] ?? null });

check("a page shows the tabs of its own group, with the right one active", () => {
  const s = at("/attendance/corrections");
  assert.equal(s.group, "เวลาทำงาน");
  assert.deepEqual(s.tabs.map((t) => t.label), ["เข้างาน / ออกงาน", "แก้ไขเวลาเข้า-ออกงาน", "กะการทำงาน", "มาสาย / ขาดงาน"]);
  assert.equal(s.activeHref, "/attendance/corrections", "not /attendance, which also starts the same");
});
check("a detail page keeps its list's tab active", () => {
  assert.equal(at("/employees/abc-123", all).activeHref, "/employees");
  assert.equal(at("/appraisal/rounds/r1/review").activeHref, "/appraisal/rounds");
});
check("the evaluation entry opens into its own pages, each with its permission", () => {
  const hr = at("/appraisal/rounds", only("campaign:manage", "campaign:update", "n:read", "training:read"));
  assert.deepEqual(hr.tabs.map((t) => t.label), ["งานประเมินของฉัน", "ผลประเมินของฉัน", "ภาพรวม", "แบบประเมิน", "รอบประเมิน", "KPI", "รอบอัตโนมัติ", "ตั้งค่า", "อบรมและพัฒนา"]);
  const manager = at("/appraisal/tasks", only("campaign:manage", "n:read", "training:read"));
  assert.equal(manager.tabs.some((t) => t.label === "รอบอัตโนมัติ"), false, "only people who can update rounds get the automatic-round tab");
  const staff = at("/appraisal/tasks", only("n:read", "training:read"));
  assert.deepEqual(staff.tabs.map((t) => t.label), ["งานประเมินของฉัน", "ผลประเมินของฉัน", "อบรมและพัฒนา"]);
});
check("two entries for one page with different ?tab= become one tab", () => {
  const s = at("/organization", all, { tab: "chart" });
  assert.deepEqual(s.tabs.map((t) => t.label), ["รายชื่อพนักงาน", "แผนกและโครงสร้างองค์กร"]);
  assert.equal(s.activeHref, "/organization");
});
check("report views are different tabs of one page; an unknown view falls back to the plain report tab", () => {
  assert.equal(at("/reports", all, { view: "leave" }).activeHref, "/reports?view=leave");
  assert.equal(at("/reports", all, { view: "overtime" }).activeHref, "/reports");
  assert.equal(at("/reports", all, { view: "attendance_daily" }).group, "เวลาทำงาน", "a query-specific entry wins over the plain page");
});
check("the launcher group has no tab row, but its pages still have a title", () => {
  const s = at("/notifications");
  assert.deepEqual([s.group, s.title, s.tabs.length], ["ภาพรวม", "แจ้งเตือน", 0]);
});
check("a group left with one visible page has no tab row", () => {
  const s = at("/import", all);
  assert.deepEqual([s.group, s.tabs.length], ["ข้อมูลระบบ", 0]);
  assert.equal(at("/leave", only()).tabs.length, 2, "two visible pages are enough");
  assert.equal(at("/admin", all).tabs.length, 0, "log out is not a tab, so the system group has only one page here");
});
check("a page outside the menu has no group, title or tabs", () => {
  assert.deepEqual(at("/profile"), { tabs: [], visibleTabs: [] });
});
check("the AI entry and log out are never tabs, and a permission-less page is left out of the tabs", () => {
  const ent = entriesOf(GROUPS, all);
  assert.equal(ent.find((e) => e.href === "/ai").tab, false);
  assert.equal(ent.some((e) => e.href === "#" && e.tab), false);
  assert.equal(at("/employees", only()).tabs.length, 0, "no employee permission, no employee tabs");
});
check("a badge key travels with its tab", () => {
  const s = at("/leave");
  assert.equal(s.tabs.find((t) => t.href === "/requests?view=approvals").badgeKey, "pendingApprovals");
});
check("best match: longer path first, a query must agree, nothing matches gives undefined", () => {
  const search = { get: () => null };
  assert.equal(bestMatchHref("/a/b/c", search, ["/a", "/a/b", "/x"]), "/a/b");
  assert.equal(bestMatchHref("/reports", { get: (k) => (k === "view" ? "leave" : null) }, ["/reports", "/reports?view=attendance", "/reports?view=leave"]), "/reports?view=leave");
  assert.equal(bestMatchHref("/zzz", search, ["/a"]), undefined);
  assert.equal(bestMatchHref("/attendance2", search, ["/attendance"]), undefined, "a longer name that merely starts the same is not a match");
});

// A long row is split into sections: the settings group by the menu's own headings, the evaluation group by fixed sections.
const SETTINGS = {
  label: "ตั้งค่าระบบ",
  items: [
    it("ข้อมูลบริษัท", "/company", "x:read", { section: "บริษัท" }),
    it("สาขา", "/branches", "x:read", { section: "บริษัท" }),
    it("ศูนย์ต้นทุน", "/cost-centers", "x:read", { section: "บริษัท" }),
    it("ตั้งค่าพื้นที่ลงเวลาเข้างาน", "/attendance/settings", "x:read", { section: "เวลาและการลา" }),
    it("ตั้งสิทธิ์ลาปีใหม่", "/leave/year-setup", "x:read", { section: "เวลาและการลา" }),
    it("สิทธิ์ลารายคน", "/leave/entitlements", "x:read", { section: "เวลาและการลา" }),
    it("เวิร์กโฟลว์อนุมัติ", "/workflows", "x:read", { section: "เวลาและการลา" }),
    it("นำเข้าข้อมูล", "/import", "x:read", { section: "ข้อมูล" }),
    it("ผู้ดูแลระบบ", "/admin", "x:read", { section: "ผู้ดูแล" }),
  ],
};
const atSettings = (pathname) => resolveSection([SETTINGS], all, pathname, { get: () => null });
check("a long row is split into the menu's own sections, and the open section holds the current page", () => {
  const s = atSettings("/leave/year-setup");
  assert.equal(s.tabs.length, 9, "all tabs are still known");
  assert.deepEqual(s.sections.map((c) => [c.name, c.active]), [["บริษัท", false], ["เวลาและการลา", true], ["ข้อมูล", false], ["ผู้ดูแล", false]]);
  assert.deepEqual(s.visibleTabs.map((t) => t.label), ["ตั้งค่าพื้นที่ลงเวลาเข้างาน", "ตั้งสิทธิ์ลาปีใหม่", "สิทธิ์ลารายคน", "เวิร์กโฟลว์อนุมัติ"]);
  assert.equal(s.sections.find((c) => c.name === "ข้อมูล").href, "/import", "a chip goes to the first tab of its section");
});
check("the evaluation group for HR is split into three sections; the active one follows the page", () => {
  const hr = at("/appraisal/forms", only("campaign:manage", "campaign:update", "n:read", "training:read"));
  assert.deepEqual(hr.sections.map((c) => [c.name, c.active]), [["ของฉัน", false], ["จัดการประเมิน", true], ["พัฒนา", false]]);
  assert.deepEqual(hr.visibleTabs.map((t) => t.label), ["ภาพรวม", "แบบประเมิน", "รอบประเมิน", "KPI", "รอบอัตโนมัติ", "ตั้งค่า"]);
  const mine = at("/appraisal/my-results", only("campaign:manage", "campaign:update", "n:read", "training:read"));
  assert.deepEqual(mine.visibleTabs.map((t) => t.label), ["งานประเมินของฉัน", "ผลประเมินของฉัน"]);
});
check("a short row stays flat, even when its tabs carry sections", () => {
  const staff = at("/appraisal/tasks", only("n:read", "training:read"));
  assert.equal(staff.sections, undefined);
  assert.equal(staff.visibleTabs.length, staff.tabs.length);
  assert.equal(at("/attendance").sections, undefined);
});
check("groupTabs keeps the row flat when a tab has no section, or there is only one section", () => {
  const t = (label, section) => ({ label, href: `/${label}`, ...(section ? { section } : {}) });
  const seven = (section) => ["a", "b", "c", "d", "e", "f", "g"].map((l, i) => t(l, section(i)));
  assert.equal(groupTabs(seven((i) => (i === 3 ? undefined : "x")), "/a").sections, undefined, "one tab without a section: flat");
  assert.equal(groupTabs(seven(() => "x"), "/a").sections, undefined, "one section only: flat");
  const two = groupTabs(seven((i) => (i < 4 ? "x" : "y")), "/g");
  assert.deepEqual(two.sections.map((c) => c.active), [false, true]);
  assert.deepEqual(two.visibleTabs.map((x) => x.label), ["e", "f", "g"]);
  assert.equal(groupTabs(seven((i) => (i < 4 ? "x" : "y")), undefined).sections[0].active, true, "a page that is not a tab opens the first section");
});

console.log(`\n${n} checks passed`);
