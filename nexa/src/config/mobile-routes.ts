/** Mobile route keys resolved from pathname + ?view= search param. */
export type MobileRouteKey =
  | "home"
  | "services"
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

/** Paths that may render page-owned mobile layouts when no registry module matches. */
export const MOBILE_CUSTOM_PATHS = [
  "/dashboard",
  "/services",
  "/attendance",
  "/leave",
  "/leave/new",
  "/profile",
] as const;

const VIEW_TITLES: Record<
  Exclude<MobileRouteKey, "home" | "services" | "leave" | "leave-new" | "profile" | "attendance">,
  string
> = {
  "time-edit": "แก้เวลาเข้า-ออกงาน",
  shift: "ตารางกะ",
  kpi: "KPI ส่วนตัว",
  review: "ประเมินผล",
  payslip: "สลิปเงินเดือน",
  expense: "เบิกค่าใช้จ่าย",
  employees: "รายชื่อพนักงาน",
  "add-employee": "เพิ่มพนักงาน",
  "org-chart": "โครงสร้างองค์กร",
  access: "สิทธิ์การเข้าถึง",
  approvals: "อนุมัติเอกสาร",
  onsite: "สิทธิ์นอกสถานที่",
  "leave-all": "วันลาพนักงาน",
  "payroll-run": "ประมวลผลเงินเดือน",
  "kpi-org": "KPI องค์กร",
  export: "ส่งออกรายงาน",
  "org-settings": "ตั้งค่าองค์กร",
  goals: "เป้าหมาย",
  feedback: "ฟีดแบ็ก",
  benefits: "สวัสดิการ",
  "menu-settings": "ตั้งค่าเมนูของฉัน",
};

const VALID_VIEWS = new Set<string>(Object.keys(VIEW_TITLES));

const PAGE_TITLES: Record<string, string> = {
  "/training": "อบรมและพัฒนา",
  "/workflows": "เวิร์กโฟลว์อนุมัติ",
  "/calendar": "ปฏิทินองค์กร",
  "/announcements": "ประกาศและแจ้งเตือน",
  "/overtime": "ล่วงเวลา (OT)",
  "/holidays": "วันหยุด",
  "/recruitment": "สรรหาพนักงาน",
  "/integrations": "การเชื่อมต่อระบบ",
  "/ai": "AI Assistant",
  "/employees/import": "นำเข้าพนักงาน",
};

export function isMobileCustomPath(pathname: string, searchParams?: URLSearchParams | null): boolean {
  if (pathname === "/services" || pathname.startsWith("/services/")) {
    const view = searchParams?.get("view") ?? "";
    return view === "" || VALID_VIEWS.has(view);
  }
  return MOBILE_CUSTOM_PATHS.filter((p) => p !== "/services").some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function resolveMobileRoute(
  pathname: string,
  searchParams?: URLSearchParams | null,
): MobileRoute | null {
  if (!isMobileCustomPath(pathname, searchParams)) return null;

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return { key: "home", title: "GV One", backHref: "/dashboard" };
  }

  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return { key: "profile", title: "โปรไฟล์", backHref: "/dashboard" };
  }

  if (pathname === "/attendance" || pathname.startsWith("/attendance/")) {
    return { key: "attendance", title: "สแกนเข้า-ออกงาน", backHref: "/services" };
  }

  if (pathname === "/leave/new") {
    return { key: "leave-new", title: "ขอลา", backHref: "/leave" };
  }

  if (pathname === "/leave" || pathname.startsWith("/leave/")) {
    return { key: "leave", title: "การลา", backHref: "/services" };
  }

  if (pathname === "/services" || pathname.startsWith("/services/")) {
    const view = searchParams?.get("view") ?? "";
    if (!view) {
      return { key: "services", title: "บริการ", backHref: "/dashboard" };
    }
    return {
      key: view as MobileRouteKey,
      title: VIEW_TITLES[view as keyof typeof VIEW_TITLES],
      backHref: "/services",
    };
  }

  return null;
}

/** Fallback titles for pages rendered inside the auto mobile shell. */
export function resolveMobilePageMeta(
  pathname: string,
  searchParams?: URLSearchParams | null,
): { title: string; backHref: string } {
  if (pathname === "/coming-soon") {
    const title = searchParams?.get("title") ?? "เร็วๆ นี้";
    return { title, backHref: "/services" };
  }

  const exact = PAGE_TITLES[pathname];
  if (exact) return { title: exact, backHref: "/services" };

  const segment = pathname.split("/").filter(Boolean).pop();
  return { title: segment ? decodeURIComponent(segment) : "GV One", backHref: "/services" };
}
