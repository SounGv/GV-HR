/**
 * NEXA — Permission catalog & role presets.
 *
 * A permission key is `${module}:${action}`. This single source of truth drives:
 *   • the DB seed (Permission + Role rows),
 *   • server-side RBAC checks (`can()` in lib/auth/rbac),
 *   • the Administration → Permission Matrix UI.
 *
 * Adding a module here + reseeding is all it takes to expose it to RBAC.
 */

export const ACTIONS = ["read", "create", "update", "delete", "approve", "export"] as const;
export type Action = (typeof ACTIONS)[number];

/** Modules mirror the product spec. `actions` narrows which verbs apply. */
export const MODULES = [
  { key: "dashboard", label: "แดชบอร์ด", actions: ["read"] },
  { key: "employee", label: "พนักงาน", actions: ["read", "create", "update", "delete", "export"] },
  { key: "attendance", label: "เวลาเข้า-ออกงาน", actions: ["read", "create", "update", "approve", "export"] },
  { key: "recognition", label: "ให้กำลังใจ", actions: ["read", "create"] },
  { key: "leave", label: "การลา", actions: ["read", "create", "update", "delete", "approve", "export"] },
  { key: "overtime", label: "ล่วงเวลา (OT)", actions: ["read", "create", "update", "delete", "approve", "export"] },
  { key: "payroll", label: "เงินเดือน", actions: ["read", "create", "update", "approve", "export"] },
  { key: "recruitment", label: "สรรหาพนักงาน", actions: ["read", "create", "update", "delete"] },
  { key: "training", label: "อบรมและพัฒนา", actions: ["read", "create", "update", "delete"] },
  { key: "performance", label: "ประเมินผลงาน", actions: ["read", "create", "update", "delete", "approve"] },
  { key: "campaign", label: "แคมเปญประเมินผล", actions: ["read", "create", "update", "delete", "approve"] },
  { key: "calibration", label: "การปรับเทียบผลประเมิน", actions: ["read", "create", "update", "approve"] },
  { key: "succession", label: "แผนสืบทอดตำแหน่ง", actions: ["read", "create", "update", "delete"] },
  { key: "kpi", label: "KPI", actions: ["read", "create", "update", "delete"] },
  { key: "okr", label: "OKR", actions: ["read", "create", "update", "delete"] },
  { key: "asset", label: "ทรัพย์สิน", actions: ["read", "create", "update", "delete"] },
  { key: "shift", label: "กะการทำงาน", actions: ["read", "create", "update", "delete", "approve"] },
  { key: "calendar", label: "ปฏิทิน", actions: ["read", "create", "update", "delete"] },
  { key: "holiday", label: "วันหยุด", actions: ["read", "create", "update", "delete"] },
  { key: "expense", label: "ค่าใช้จ่าย", actions: ["read", "create", "update", "delete", "approve"] },
  { key: "workflow", label: "เวิร์กโฟลว์", actions: ["read", "create", "update", "delete"] },
  { key: "report", label: "ศูนย์รายงาน", actions: ["read", "export"] },
  { key: "notification", label: "การแจ้งเตือน", actions: ["read", "create"] },
  { key: "announcement", label: "ประกาศ", actions: ["read", "create", "update", "delete"] },
  { key: "ai", label: "AI Assistant", actions: ["read", "create"] },
  { key: "admin", label: "ผู้ดูแลระบบ", actions: ["read", "create", "update", "delete"] },
  { key: "developer", label: "Developer API", actions: ["read", "create", "update", "delete"] },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export interface PermissionDef {
  key: string; // "employee:create"
  module: string;
  action: Action;
  label: string;
}

/** Flattened catalog of every valid permission. */
export const PERMISSIONS: PermissionDef[] = MODULES.flatMap((m) =>
  m.actions.map((action) => ({
    key: `${m.key}:${action}`,
    module: m.key,
    action: action as Action,
    label: `${m.label} — ${action}`,
  })),
);

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// ─────────────────────── Role presets ───────────────────────
// Wildcards: "*" = every permission; "module:*" = every action of a module.

export interface RolePreset {
  name: string;
  description: string;
  isSystem: boolean;
  /** Permission keys or wildcards. */
  permissions: string[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    name: "Super Admin",
    description: "สิทธิ์เต็มทุกโมดูล",
    isSystem: true,
    permissions: ["*"],
  },
  {
    name: "HR Manager",
    description: "จัดการงานบุคคลทั้งหมด",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "employee:*",
      "attendance:*",
      "recognition:*",
      "leave:*",
      "overtime:*",
      "payroll:*",
      "recruitment:*",
      "training:*",
      "performance:*",
      "campaign:*",
      "calibration:*",
      "succession:*",
      "kpi:*",
      "okr:*",
      "asset:*",
      "shift:*",
      "calendar:*",
      "holiday:*",
      "expense:*",
      "workflow:*",
      "report:*",
      "notification:*",
      "announcement:*",
      "ai:*",
    ],
  },
  {
    name: "Manager",
    description: "หัวหน้าทีม — ดูแลและอนุมัติทีมของตน",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "employee:read",
      "attendance:read",
      "attendance:approve",
      "recognition:read",
      "recognition:create",
      "leave:read",
      "leave:approve",
      "overtime:read",
      "overtime:approve",
      "performance:read",
      "performance:create",
      "performance:update",
      "campaign:read",
      "calibration:read",
      "kpi:read",
      "okr:read",
      "shift:read",
      "calendar:read",
      "workflow:read",
      "report:read",
      "announcement:read",
      "ai:read",
    ],
  },
  {
    name: "Employee",
    description: "พนักงานทั่วไป — เข้าถึงข้อมูลของตนเอง",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "attendance:read",
      "attendance:create",
      "recognition:read",
      "leave:read",
      "leave:create",
      "overtime:read",
      "overtime:create",
      "payroll:read",
      "expense:read",
      "expense:create",
      "training:read",
      "performance:read",
      "campaign:read",
      "kpi:read",
      "okr:read",
      "holiday:read",
      "calendar:read",
      "shift:read",
      "workflow:read",
      "notification:read",
      "announcement:read",
      "ai:read",
    ],
  },
  {
    name: "Finance",
    description: "ฝ่ายการเงิน — เงินเดือนและค่าใช้จ่าย",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "employee:read",
      "payroll:*",
      "expense:*",
      "report:read",
      "report:export",
      "ai:read",
    ],
  },
];

/**
 * Expand a preset's permission list (with wildcards) into concrete keys.
 */
export function expandPermissions(patterns: string[]): string[] {
  const set = new Set<string>();
  for (const pattern of patterns) {
    if (pattern === "*") {
      ALL_PERMISSION_KEYS.forEach((k) => set.add(k));
    } else if (pattern.endsWith(":*")) {
      const mod = pattern.slice(0, -2);
      PERMISSIONS.filter((p) => p.module === mod).forEach((p) => set.add(p.key));
    } else {
      set.add(pattern);
    }
  }
  return [...set];
}
