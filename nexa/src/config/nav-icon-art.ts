/**
 * Art for the menu icons shown in front of every sub-menu entry in the side menu (pure data, no imports; checked by
 * `node --experimental-strip-types scripts/check-nav-icons.mjs`).
 *
 * Designed with Codex in five rounds (mock files menu-icons-codex-mock*.html in the project folder) and drawn for 16px:
 * an outline in the current text colour, so the icon follows the item (white on the open item, light in dark mode) and
 * needs no gradient definitions. The paths are static strings written here, never user input. Three class names say how
 * a part is drawn (see `.gv-nav-ico` in globals.css): `mass` the main outline, `detail` the inner lines, `solid` a dot.
 * `fine` and `shadow` parts belong to the larger 20 and 32px drawings of the mock and are not drawn at 16px.
 */

export type NavIconKey =

  | "home"
  | "orgCalendar"
  | "announce"
  | "meeting"
  | "guide"
  | "checkin"
  | "correction"
  | "shift"
  | "holiday"
  | "attendanceAlert"
  | "leave"
  | "leaveHistory"
  | "ot"
  | "approvals"
  | "people"
  | "departments"
  | "orgChart"
  | "recruit"
  | "assets"
  | "evaluation"
  | "evalResult"
  | "evalManage"
  | "training"
  | "benefitHistory"
  | "expense"
  | "medical"
  | "loan"
  | "benefitReport"
  | "attendanceMonthly"
  | "leaveReport"
  | "evalReport"
  | "report"
  | "company"
  | "branch"
  | "cost"
  | "location"
  | "yearsetup"
  | "entitlement"
  | "workflow"
  | "importData"
  | "audit"
  | "admin"
  | "integration";

/** Inner SVG (viewBox 0 0 24 24) of each icon. */
export const NAV_ICON_ART: Record<NavIconKey, string> = {
  home: "<path class=\"mass\" d=\"M3.5 11.2 12 3.8l8.5 7.4v8.3A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5z\"/><path class=\"detail\" d=\"M9.5 21v-6.5h5V21\"/><path class=\"fine\" d=\"m6 11 6-5.2 6 5.2\"/>",
  orgCalendar: "<path class=\"mass\" d=\"M4 21V7l8-4 8 4v14z\"/><path class=\"detail\" d=\"M2.5 21h19M8 21v-5h8v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01\"/><path class=\"fine\" d=\"M6 6.4 12 4l6 2.4\"/>",
  announce: "<path class=\"mass\" d=\"m3 10 17-5v13L3 14z\"/><path class=\"detail\" d=\"M3 10v4M8 15l1.5 5H6l-1-5M20 9c2 1 2 3 0 5\"/><path class=\"fine\" d=\"m6 10 11-3\"/>",
  meeting: "<circle class=\"mass\" cx=\"8\" cy=\"9\" r=\"4\"/><circle class=\"mass\" cx=\"16.5\" cy=\"10\" r=\"3.4\"/><path class=\"detail\" d=\"M2.5 21c.3-4 2.4-6.3 5.5-6.3 2.3 0 4.1 1.2 5 3.4M13 20h6l2.5 2v-7h-7\"/><path class=\"fine\" d=\"M16 17h3M16 19h2\"/>",
  guide: "<path class=\"mass\" d=\"M3 4.5h6a3 3 0 0 1 3 3V21a3 3 0 0 0-3-3H3zM21 4.5h-6a3 3 0 0 0-3 3V21a3 3 0 0 1 3-3h6z\"/><path class=\"detail\" d=\"M12 7.5V21M6 9h3M15 9h3\"/><path class=\"fine\" d=\"M6 12h3M15 12h3\"/>",
  checkin: "<circle class=\"mass\" cx=\"12\" cy=\"12\" r=\"9\"/><path class=\"detail\" d=\"m7.5 12.5 3 3 6-6\"/><path class=\"fine\" d=\"M6 7a8 8 0 0 1 8-2\"/>",
  correction: "<path class=\"mass\" d=\"m4 20 1-5L16 4a2.5 2.5 0 0 1 3.5 3.5l-11 11z\"/><path class=\"detail\" d=\"m14 6 4 4M4 20l4.5-1.5\"/><path class=\"fine\" d=\"m7 15 8-8\"/>",
  shift: "<circle class=\"mass\" cx=\"10\" cy=\"11\" r=\"7.5\"/><path class=\"detail\" d=\"M10 7v4l3 2M15 17h6m0 0-2.5-2.5M21 17l-2.5 2.5M9 21H3m0 0 2.5-2.5M3 21l2.5 2.5\"/><path class=\"fine\" d=\"M5.5 6.5A7 7 0 0 1 10 4\"/>",
  holiday: "<path class=\"mass\" d=\"M5 5h13l-2.2 4 2.2 4H5z\"/><path class=\"detail\" d=\"M5 21V4M5 13h13\"/><path class=\"fine\" d=\"M7 6.5h7\"/>",
  attendanceAlert: "<path class=\"mass\" d=\"m12 3 10 18H2z\"/><path class=\"detail\" d=\"M12 8v6M12 18h.01\"/><path class=\"fine\" d=\"m12 5 7.5 14\"/>",
  leave: "<path class=\"mass\" d=\"M4 3h11l4 4v14H4z\"/><path class=\"detail\" d=\"M15 3v5h4M7 15c2.3-4 7.7-4 10 0M12 11v8M9.5 19c.5 1.5 2.5 1.5 3 0\"/><path class=\"fine\" d=\"M7 7h5M7 10h3\"/>",
  leaveHistory: "<path class=\"mass\" d=\"M4 8V3m0 0 4 4M4 3a9 9 0 1 1-1 11\"/><circle class=\"detail\" cx=\"12\" cy=\"12\" r=\"4.5\"/><path class=\"detail\" d=\"M12 9v3l2 1.5\"/>",
  ot: "<circle class=\"mass\" cx=\"11\" cy=\"13\" r=\"8\"/><path class=\"detail\" d=\"M11 8v5l3 2M8 2h6M11 5V3M18 4l2 2\"/><path class=\"fine\" d=\"M6 9a6 6 0 0 1 5-2\"/>",
  approvals: "<rect class=\"mass\" x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"3\"/><rect class=\"mass\" x=\"9\" y=\"2\" width=\"6\" height=\"4\" rx=\"1.5\"/><path class=\"detail\" d=\"m8.5 14 2.5 2.5 5-6\"/><path class=\"fine\" d=\"M8 8h8\"/>",
  people: "<rect class=\"mass\" x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3\"/><circle class=\"detail\" cx=\"9\" cy=\"10\" r=\"2.3\"/><path class=\"detail\" d=\"M5.5 16c.7-2 2-3 3.5-3s2.8 1 3.5 3M15 9h3M15 13h3\"/><path class=\"fine\" d=\"M5 6.5h14\"/>",
  departments: "<circle class=\"mass\" cx=\"7\" cy=\"7\" r=\"3\"/><circle class=\"mass\" cx=\"17\" cy=\"7\" r=\"3\"/><rect class=\"mass\" x=\"9\" y=\"16\" width=\"6\" height=\"5\" rx=\"2\"/><path class=\"detail\" d=\"M7 10v3h10v-3M12 13v3\"/>",
  orgChart: "<rect class=\"mass\" x=\"9\" y=\"3\" width=\"6\" height=\"5\" rx=\"2\"/><rect class=\"mass\" x=\"3\" y=\"16\" width=\"6\" height=\"5\" rx=\"2\"/><rect class=\"mass\" x=\"15\" y=\"16\" width=\"6\" height=\"5\" rx=\"2\"/><path class=\"detail\" d=\"M12 8v4M6 16v-4h12v4\"/>",
  recruit: "<circle class=\"mass\" cx=\"9\" cy=\"8\" r=\"4\"/><path class=\"detail\" d=\"M3 21c0-4 2.5-6 6-6s6 2 6 6M18 8v6M15 11h6\"/><path class=\"fine\" d=\"M6 7a3 3 0 0 1 3-2\"/>",
  assets: "<path class=\"mass\" d=\"M4 3h10l4 4v5H4zM3 14l9-3 9 3-9 4z\"/><path class=\"detail\" d=\"M14 3v4h4M3 14v5l9 3 9-3v-5M12 18v4\"/><path class=\"fine\" d=\"M6 6h5\"/>",
  evaluation: "<rect class=\"mass\" x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"3\"/><path class=\"detail\" d=\"m12 8 1.5 3 3.5.5-2.5 2.4.6 3.5-3.1-1.7-3.1 1.7.6-3.5L7 11.5l3.5-.5z\"/><path class=\"fine\" d=\"M8 6h8\"/>",
  evalResult: "<rect class=\"mass\" x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"3\"/><path class=\"detail\" d=\"m7 17 3-4 3 2 4-6M7 8h5\"/><path class=\"fine\" d=\"M6 5h12\"/>",
  evalManage: "<path class=\"mass\" d=\"M3 5h18v4H3zM3 15h18v4H3z\"/><path class=\"detail\" d=\"M4 7h7M17 7h3M4 17h3M13 17h7\"/><circle class=\"detail\" cx=\"14\" cy=\"7\" r=\"3\"/><circle class=\"detail\" cx=\"10\" cy=\"17\" r=\"3\"/>",
  training: "<path class=\"mass\" d=\"m2 9 10-5 10 5-10 6z\"/><path class=\"detail\" d=\"M6 12v5c3.5 2.5 8.5 2.5 12 0v-5M21 9v7\"/><path class=\"fine\" d=\"m6 9 6-3 6 3\"/>",
  benefitHistory: "<path class=\"mass\" d=\"M12 20S4 15 4 9a4 4 0 0 1 7-2.7L12 8l1-1.7A4 4 0 0 1 20 9c0 1-.2 2-.6 2.8\"/><path class=\"detail\" d=\"M20 15a4 4 0 1 1-3-3.9M20 12v3h-3\"/><path class=\"fine\" d=\"M6 8c1-2 3-2 4 0\"/>",
  expense: "<path class=\"mass\" d=\"M5 3h14v18l-3-2-4 2-4-2-3 2z\"/><path class=\"detail\" d=\"M9 8h6M9 12h6M9 16h3\"/><path class=\"fine\" d=\"M7 5h10\"/>",
  medical: "<rect class=\"mass\" x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"3\"/><path class=\"detail\" d=\"M8 7V4h8v3M12 10v7M8.5 13.5h7\"/><path class=\"fine\" d=\"M5 9h14\"/>",
  loan: "<path class=\"mass\" d=\"m3 10 9-6 9 6v2H3z\"/><path class=\"detail\" d=\"M5 12v6M9 12v6M15 12v6M19 12v6M3 20h18M9 8h6\"/><path class=\"fine\" d=\"m6 10 6-4 6 4\"/>",
  benefitReport: "<path class=\"mass\" d=\"M5 3h10l4 4v14H5z\"/><path class=\"detail\" d=\"M15 3v5h4M8 16v-3M11 16v-5M14 16v-2M8 8c.8-1.5 2.5-1 3.1.3.7-1.3 2.4-1.8 3.2-.3 0 2-3.2 3.6-3.2 3.6S8 10 8 8z\"/><path class=\"fine\" d=\"M7 5h5\"/>",
  attendanceMonthly: "<path class=\"mass\" d=\"M4 20V12h4v8zm6 0V7h4v13zm6 0V10h4v10z\"/><path class=\"detail\" d=\"M3 21h18M4 8l5-3 5 2 6-4\"/><path class=\"fine\" d=\"M4 4h5M17 6h3\"/>",
  leaveReport: "<path class=\"mass\" d=\"M3 12c2.5-6 15.5-6 18 0M12 7v12a3 3 0 0 1-5 2\"/><path class=\"detail\" d=\"M7 12v3m5-3v5m5-5v7\"/>",
  evalReport: "<rect class=\"mass\" x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"3\"/><path class=\"detail\" d=\"M8 17v-3M16 17v-5M12 17V9m0-5 .7 1.4 1.5.2-1.1 1 .3 1.6-1.4-.8-1.4.8.3-1.6-1.1-1 1.5-.2z\"/><path class=\"fine\" d=\"M6 5h3\"/>",
  report: "<rect class=\"mass\" x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path class=\"detail\" d=\"M7 17v-5M12 17V8M17 17v-7\"/><path class=\"fine\" d=\"M5 5h14\"/>",
  company: "<path class=\"mass\" d=\"M4 21V5l10-2v18M14 8h6v13z\"/><path class=\"detail\" d=\"M7 8h3M7 12h3M7 16h3M17 12h1M2 21h20\"/><path class=\"fine\" d=\"m6 6 6-1\"/>",
  branch: "<path class=\"mass\" d=\"M6 5a3 3 0 1 1 6 0c0 2-3 5-3 5S6 7 6 5zM14 17a3 3 0 1 1 6 0c0 2-3 5-3 5s-3-3-3-5z\"/><path class=\"detail\" d=\"M9 10v4h8\"/><circle class=\"fine\" cx=\"9\" cy=\"5\" r=\"1\"/>",
  cost: "<circle class=\"mass\" cx=\"12\" cy=\"12\" r=\"9\"/><circle class=\"detail\" cx=\"12\" cy=\"12\" r=\"4\"/><path class=\"detail\" d=\"M12 3v3M21 12h-3M12 21v-3M3 12h3\"/><path class=\"fine\" d=\"M6 7a8 8 0 0 1 7-3\"/>",
  location: "<path class=\"mass\" d=\"M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z\"/><path class=\"detail\" d=\"m9 10 2 2 4-4\"/><path class=\"fine\" d=\"M8 6a6 6 0 0 1 6-2\"/>",
  yearsetup: "<path class=\"mass\" d=\"M3 5h18v16H3z\"/><path class=\"detail\" d=\"M7 3v4M17 3v4M3 10h18m-12 5 2 2 4-4\"/><path class=\"fine\" d=\"M5 7h14\"/>",
  entitlement: "<circle class=\"mass\" cx=\"7.5\" cy=\"7\" r=\"3.2\"/><path class=\"mass\" d=\"M2.5 20c.2-4.1 2-6.4 5-6.4 2.1 0 3.5 1 4.3 2.8V20z\"/><rect class=\"mass\" x=\"12\" y=\"9\" width=\"9.5\" height=\"10.5\" rx=\"2\"/><path class=\"detail\" d=\"M14.2 14.5c1.5-2.6 3.6-2.6 5.1 0M16.75 12v5.5M15.2 17.5c.4 1.2 2.7 1.2 3.1 0\"/><path class=\"fine\" d=\"M14 11h5.5\"/>",
  workflow: "<circle class=\"mass\" cx=\"6\" cy=\"5\" r=\"2.5\"/><circle class=\"mass\" cx=\"6\" cy=\"19\" r=\"2.5\"/><circle class=\"mass\" cx=\"18\" cy=\"12\" r=\"2.5\"/><path class=\"detail\" d=\"M6 7.5v9M8.5 5c5 0 7 2 7 4.5M8.5 19c5 0 7-2 7-4.5\"/>",
  importData: "<path class=\"mass\" d=\"M4 14v7h16v-7z\"/><path class=\"detail\" d=\"M12 3v13M8 7l4-4 4 4M7 18h10\"/><path class=\"fine\" d=\"M6 16h4\"/>",
  audit: "<path class=\"mass\" d=\"M5 3h12l3 3v9H5z\"/><path class=\"detail\" d=\"M17 3v4h3M8 8h5M8 11h4M20 18a4 4 0 1 1-3-3.8M20 15v3h-3\"/><path class=\"fine\" d=\"M7 5h7\"/>",
  admin: "<path class=\"mass\" d=\"m12 3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/><circle class=\"detail\" cx=\"12\" cy=\"10\" r=\"2.5\"/><path class=\"detail\" d=\"M8 17c.5-2.2 2-3.5 4-3.5s3.5 1.3 4 3.5\"/><path class=\"fine\" d=\"m7 7 5-2 5 2\"/>",
  integration: "<path class=\"mass\" d=\"M5 8h8v3a4 4 0 0 1-4 4v6H7v-6a4 4 0 0 1-2-4z\"/><path class=\"detail\" d=\"M7 3v5M11 3v5M15 9h4v4M19 9l-6 6\"/><path class=\"fine\" d=\"M6 10h6\"/>",
};

/** Which icon a side-menu entry gets, by its href (with the query when the entry has one). */
export const NAV_ICON_BY_HREF: Record<string, NavIconKey> = {
  "/dashboard": "home",
  "/calendar": "orgCalendar",
  "/announcements": "announce",
  "/meetings": "meeting",
  "/help": "guide",
  "/attendance": "checkin",
  "/attendance/corrections": "correction",
  "/shifts": "shift",
  "/holidays": "holiday",
  "/reports?view=attendance_daily": "attendanceAlert",
  "/leave/new": "leave",
  "/leave": "leaveHistory",
  "/overtime": "ot",
  "/requests?view=approvals": "approvals",
  "/employees": "people",
  "/organization?tab=departments": "departments",
  "/organization?tab=chart": "orgChart",
  "/recruitment": "recruit",
  "/assets": "assets",
  "/appraisal/tasks": "evaluation",
  "/appraisal/my-results": "evalResult",
  "/appraisal": "evalManage",
  "/training": "training",
  "/benefits/history": "benefitHistory",
  "/expenses": "expense",
  "/benefits/medical": "medical",
  "/benefits/loans": "loan",
  "/benefits/report": "benefitReport",
  "/reports?view=attendance": "attendanceMonthly",
  "/reports?view=leave": "leaveReport",
  "/reports?view=performance": "evalReport",
  "/reports": "report",
  "/company": "company",
  "/branches": "branch",
  "/cost-centers": "cost",
  "/attendance/settings": "location",
  "/leave/year-setup": "yearsetup",
  "/leave/entitlements": "entitlement",
  "/workflows": "workflow",
  "/import": "importData",
  "/admin?tab=audit": "audit",
  "/admin": "admin",
  "/integrations": "integration",
};

export function navIconArt(href: string): string | null {
  const key = NAV_ICON_BY_HREF[href];
  return key ? NAV_ICON_ART[key] : null;
}
