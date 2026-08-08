/** Mobile route keys resolved from pathname + ?view= search param. */
export type MobileRouteKey =
  | "home"
  | "attendance"
  | "leave"
  | "leave-new"
  | "profile"
  | "time-edit"
  | "shift"
  | "kpi"
  | "review"
  | "payslip"
  | "expense"
  | "employees"
  | "add-employee"
  | "org-chart"
  | "access"
  | "approvals"
  | "onsite"
  | "leave-all"
  | "payroll-run"
  | "kpi-org"
  | "export"
  | "org-settings"
  | "goals"
  | "feedback"
  | "benefits"
  | "menu-settings";

export interface MobileRoute {
  key: MobileRouteKey;
  title: string;
  backHref: string;
}

/** Paths that render the mobile shell instead of the desktop page chrome. */
export const MOBILE_CUSTOM_PATHS = [
  "/dashboard",
  "/services",
  "/attendance",
  "/leave",
  "/leave/new",
  "/profile",
] as const;

export type MobileCustomPath = (typeof MOBILE_CUSTOM_PATHS)[number];

const VIEW_TITLES: Record<Exclude<MobileRouteKey, "home" | "leave" | "leave-new" | "profile" | "attendance">, string> = {
  "time-edit": "แก้ไขเวลา",
  shift: "กะการทำงาน",
  kpi: "KPI & Level",
  review: "ประเมินผลงาน",
  payslip: "สลิปเงินเดือน",
  expense: "เบิกจ่าย",
  employees: "พนักงาน",
  "add-employee": "เพิ่มพนักงาน",
  "org-chart": "แผนผังองค์กร",
  access: "ผู้ดูแลระบบ",
  approvals: "คำขออนุมัติ",
  onsite: "พื้นที่เช็คอิน",
  "leave-all": "การลา",
  "payroll-run": "จัดการเงินเดือน",
  "kpi-org": "KPI องค์กร",
  export: "รายงานและส่งออก",
  "org-settings": "ข้อมูลบริษัท",
  goals: "เป้าหมาย",
  feedback: "Feedback 360",
  benefits: "สวัสดิการ",
  "menu-settings": "ตั้งค่าเมนู",
};

const VALID_VIEWS = new Set<string>(Object.keys(VIEW_TITLES));

export function isMobileCustomPath(pathname: string, searchParams?: URLSearchParams | null): boolean {
  if (pathname === "/services" || pathname.startsWith("/services/")) {
    const view = searchParams?.get("view") ?? "";
    return VALID_VIEWS.has(view);
  }
  return MOBILE_CUSTOM_PATHS.filter((p) => p !== "/services").some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function resolveMobileRoute(pathname: string, searchParams?: URLSearchParams | null): MobileRoute | null {
  if (!isMobileCustomPath(pathname, searchParams)) return null;

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return { key: "home", title: "GV One", backHref: "/dashboard" };
  }

  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return { key: "profile", title: "โปรไฟล์", backHref: "/dashboard" };
  }

  if (pathname === "/attendance" || pathname.startsWith("/attendance/")) {
    return { key: "attendance", title: "เช็คอิน", backHref: "/dashboard" };
  }

  if (pathname === "/leave/new") {
    return { key: "leave-new", title: "ขอลา", backHref: "/leave" };
  }

  if (pathname === "/leave" || pathname.startsWith("/leave/")) {
    return { key: "leave", title: "การลา", backHref: "/dashboard" };
  }

  if (pathname === "/services" || pathname.startsWith("/services/")) {
    const view = searchParams?.get("view") ?? "";
    return {
      key: view as MobileRouteKey,
      title: VIEW_TITLES[view as keyof typeof VIEW_TITLES],
      backHref: "/dashboard",
    };
  }

  return null;
}
