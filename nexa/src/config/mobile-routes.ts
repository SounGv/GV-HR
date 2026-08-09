export interface MobileRouteMeta {
  title: string;
  backHref?: string;
}

type RoutePattern = {
  pattern: RegExp;
  meta: MobileRouteMeta;
};

/** Pages that ship a dedicated mobile layout (no auto shell). */
export const MOBILE_CUSTOM_PATHS = new Set([
  "/dashboard",
  "/services",
  "/profile",
  "/leave",
  "/leave/new",
  "/attendance",
  "/requests",
  "/payroll",
]);

const EXACT: Record<string, MobileRouteMeta> = {
  "/ai": { title: "AI Assistant", backHref: "/dashboard" },
  "/ai-evaluation": { title: "AI ประเมินผล", backHref: "/ai" },
  "/announcements": { title: "ประกาศและแจ้งเตือน", backHref: "/services" },
  "/announcements/new": { title: "สร้างประกาศ", backHref: "/announcements" },
  "/assets": { title: "เอกสารและทรัพย์สิน", backHref: "/services" },
  "/assets/new": { title: "เพิ่มทรัพย์สิน", backHref: "/assets" },
  "/attendance/settings": { title: "สิทธิ์นอกสถานที่", backHref: "/services" },
  "/admin": { title: "สิทธิ์การเข้าถึง", backHref: "/services" },
  "/admin/roles/new": { title: "สร้างบทบาท", backHref: "/admin" },
  "/branches": { title: "สาขา", backHref: "/company" },
  "/branches/new": { title: "เพิ่มสาขา", backHref: "/branches" },
  "/calendar": { title: "ปฏิทินองค์กร", backHref: "/services" },
  "/calendar/events/new": { title: "สร้างกิจกรรม", backHref: "/calendar" },
  "/coming-soon": { title: "เร็วๆ นี้", backHref: "/services" },
  "/company": { title: "ตั้งค่าองค์กร", backHref: "/services" },
  "/cost-centers": { title: "ศูนย์ต้นทุน", backHref: "/company" },
  "/cost-centers/new": { title: "เพิ่มศูนย์ต้นทุน", backHref: "/cost-centers" },
  "/employees": { title: "รายชื่อพนักงาน", backHref: "/services" },
  "/employees/new": { title: "เพิ่มพนักงาน", backHref: "/employees" },
  "/employees/import": { title: "นำเข้าพนักงาน", backHref: "/employees" },
  "/expenses": { title: "เบิกค่าใช้จ่าย", backHref: "/services" },
  "/expenses/new": { title: "เบิกค่าใช้จ่าย", backHref: "/expenses" },
  "/holidays": { title: "วันหยุด", backHref: "/services" },
  "/holidays/new": { title: "เพิ่มวันหยุด", backHref: "/holidays" },
  "/integrations": { title: "การเชื่อมต่อระบบ", backHref: "/services" },
  "/kpi": { title: "KPI ส่วนตัว", backHref: "/services" },
  "/notifications": { title: "การแจ้งเตือน", backHref: "/dashboard" },
  "/kpi/new": { title: "สร้าง KPI", backHref: "/kpi" },
  "/organization": { title: "โครงสร้างองค์กร", backHref: "/services" },
  "/organization/departments/new": { title: "เพิ่มแผนก", backHref: "/organization" },
  "/organization/positions/new": { title: "เพิ่มตำแหน่ง", backHref: "/organization" },
  "/overtime": { title: "ล่วงเวลา (OT)", backHref: "/requests" },
  "/overtime/new": { title: "ขอ OT", backHref: "/requests" },
  "/performance": { title: "ประเมินผล", backHref: "/services" },
  "/performance/new": { title: "สร้างรอบประเมิน", backHref: "/performance" },
  "/performance/competencies": { title: "สมรรถนะ", backHref: "/performance" },
  "/performance/competencies/new": { title: "เพิ่มสมรรถนะ", backHref: "/performance/competencies" },
  "/performance/competencies/categories/new": { title: "เพิ่มหมวดสมรรถนะ", backHref: "/performance/competencies" },
  "/performance/campaigns/new": { title: "สร้างแคมเปญ", backHref: "/performance" },
  "/performance/campaigns/schedules": { title: "ตารางประเมิน", backHref: "/performance" },
  "/performance/campaigns/schedules/new": { title: "สร้างตารางประเมิน", backHref: "/performance/campaigns/schedules" },
  "/performance/succession/new": { title: "แผนทดแทน", backHref: "/performance" },
  "/recruitment": { title: "สรรหาพนักงาน", backHref: "/services" },
  "/recruitment/jobs/new": { title: "เปิดตำแหน่ง", backHref: "/recruitment" },
  "/recruitment/candidates/new": { title: "เพิ่มผู้สมัคร", backHref: "/recruitment" },
  "/reports": { title: "ส่งออกรายงาน", backHref: "/services" },
  "/shifts": { title: "ตารางกะ", backHref: "/services" },
  "/shifts/templates/new": { title: "สร้างเทมเพลตกะ", backHref: "/shifts" },
  "/training": { title: "อบรมและพัฒนา", backHref: "/services" },
  "/training/new": { title: "สร้างหลักสูตร", backHref: "/training" },
  "/workflows": { title: "อนุมัติเอกสาร", backHref: "/services" },
  "/workflows/new": { title: "สร้างเวิร์กโฟลว์", backHref: "/workflows" },
  "/workflows/requests/new": { title: "แก้เวลาเข้า-ออกงาน", backHref: "/services" },
};

const PATTERNS: RoutePattern[] = [
  { pattern: /^\/employees\/[^/]+\/account$/, meta: { title: "บัญชีผู้ใช้", backHref: "/employees" } },
  { pattern: /^\/employees\/[^/]+\/edit$/, meta: { title: "แก้ไขพนักงาน", backHref: "/employees" } },
  { pattern: /^\/employees\/[^/]+\/evaluation-history$/, meta: { title: "ประวัติการประเมิน", backHref: "/employees" } },
  { pattern: /^\/employees\/[^/]+\/recognize$/, meta: { title: "ให้กำลังใจ", backHref: "/employees" } },
  { pattern: /^\/employees\/[^/]+$/, meta: { title: "โปรไฟล์พนักงาน", backHref: "/employees" } },
  { pattern: /^\/admin\/users\/[^/]+\/roles$/, meta: { title: "กำหนดบทบาท", backHref: "/admin" } },
  { pattern: /^\/payroll\/[^/]+$/, meta: { title: "รายละเอียดสลิป", backHref: "/payroll" } },
  { pattern: /^\/leave\/[^/]+$/, meta: { title: "รายละเอียดการลา", backHref: "/leave" } },
  { pattern: /^\/overtime\/[^/]+$/, meta: { title: "รายละเอียด OT", backHref: "/overtime" } },
  { pattern: /^\/expenses\/[^/]+$/, meta: { title: "รายละเอียดเบิกจ่าย", backHref: "/expenses" } },
  { pattern: /^\/kpi\/[^/]+\/progress$/, meta: { title: "บันทึกความคืบหน้า KPI", backHref: "/kpi" } },
  { pattern: /^\/kpi\/[^/]+\/edit$/, meta: { title: "แก้ไข KPI", backHref: "/kpi" } },
  { pattern: /^\/kpi\/[^/]+$/, meta: { title: "รายละเอียด KPI", backHref: "/kpi" } },
  { pattern: /^\/performance\/[^/]+\/edit$/, meta: { title: "แก้ไขการประเมิน", backHref: "/performance" } },
  { pattern: /^\/performance\/[^/]+$/, meta: { title: "รายละเอียดการประเมิน", backHref: "/performance" } },
  { pattern: /^\/performance\/campaigns\/[^/]+\/edit$/, meta: { title: "แก้ไขแคมเปญ", backHref: "/performance" } },
  { pattern: /^\/performance\/campaigns\/[^/]+\/participants\/[^/]+$/, meta: { title: "ผู้เข้าร่วมประเมิน", backHref: "/performance" } },
  { pattern: /^\/performance\/campaigns\/[^/]+$/, meta: { title: "แคมเปญประเมิน", backHref: "/performance" } },
  { pattern: /^\/performance\/campaigns\/schedules\/[^/]+\/edit$/, meta: { title: "แก้ไขตารางประเมิน", backHref: "/performance/campaigns/schedules" } },
  { pattern: /^\/performance\/competencies\/categories\/[^/]+\/edit$/, meta: { title: "แก้ไขหมวดสมรรถนะ", backHref: "/performance/competencies" } },
  { pattern: /^\/performance\/competencies\/[^/]+\/edit$/, meta: { title: "แก้ไขสมรรถนะ", backHref: "/performance/competencies" } },
  { pattern: /^\/performance\/succession\/[^/]+\/edit$/, meta: { title: "แก้ไขแผนทดแทน", backHref: "/performance" } },
  { pattern: /^\/performance\/succession\/[^/]+$/, meta: { title: "แผนทดแทน", backHref: "/performance" } },
  { pattern: /^\/workflows\/requests\/[^/]+$/, meta: { title: "รายละเอียดคำขอ", backHref: "/workflows" } },
  { pattern: /^\/workflows\/[^/]+\/edit$/, meta: { title: "แก้ไขเวิร์กโฟลว์", backHref: "/workflows" } },
  { pattern: /^\/recruitment\/jobs\/[^/]+\/edit$/, meta: { title: "แก้ไขตำแหน่ง", backHref: "/recruitment" } },
  { pattern: /^\/recruitment\/jobs\/[^/]+$/, meta: { title: "รายละเอียดตำแหน่ง", backHref: "/recruitment" } },
  { pattern: /^\/recruitment\/candidates\/[^/]+\/edit$/, meta: { title: "แก้ไขผู้สมัคร", backHref: "/recruitment" } },
  { pattern: /^\/recruitment\/candidates\/[^/]+$/, meta: { title: "ผู้สมัคร", backHref: "/recruitment" } },
  { pattern: /^\/training\/[^/]+\/edit$/, meta: { title: "แก้ไขหลักสูตร", backHref: "/training" } },
  { pattern: /^\/training\/[^/]+$/, meta: { title: "รายละเอียดหลักสูตร", backHref: "/training" } },
  { pattern: /^\/shifts\/templates\/[^/]+\/edit$/, meta: { title: "แก้ไขเทมเพลตกะ", backHref: "/shifts" } },
  { pattern: /^\/announcements\/[^/]+\/edit$/, meta: { title: "แก้ไขประกาศ", backHref: "/announcements" } },
  { pattern: /^\/announcements\/[^/]+$/, meta: { title: "รายละเอียดประกาศ", backHref: "/announcements" } },
  { pattern: /^\/assets\/[^/]+\/edit$/, meta: { title: "แก้ไขทรัพย์สิน", backHref: "/assets" } },
  { pattern: /^\/assets\/[^/]+$/, meta: { title: "รายละเอียดทรัพย์สิน", backHref: "/assets" } },
  { pattern: /^\/holidays\/[^/]+\/edit$/, meta: { title: "แก้ไขวันหยุด", backHref: "/holidays" } },
  { pattern: /^\/holidays\/[^/]+$/, meta: { title: "รายละเอียดวันหยุด", backHref: "/holidays" } },
  { pattern: /^\/branches\/[^/]+\/qr$/, meta: { title: "QR เช็คอิน", backHref: "/branches" } },
  { pattern: /^\/branches\/[^/]+\/edit$/, meta: { title: "แก้ไขสาขา", backHref: "/branches" } },
  { pattern: /^\/cost-centers\/[^/]+\/edit$/, meta: { title: "แก้ไขศูนย์ต้นทุน", backHref: "/cost-centers" } },
  { pattern: /^\/organization\/departments\/[^/]+\/edit$/, meta: { title: "แก้ไขแผนก", backHref: "/organization" } },
  { pattern: /^\/organization\/positions\/[^/]+\/edit$/, meta: { title: "แก้ไขตำแหน่ง", backHref: "/organization" } },
  { pattern: /^\/calendar\/events\/[^/]+\/edit$/, meta: { title: "แก้ไขกิจกรรม", backHref: "/calendar" } },
  { pattern: /^\/integrations\/[^/]+$/, meta: { title: "การเชื่อมต่อ", backHref: "/integrations" } },
];

export function isMobileCustomPath(pathname: string): boolean {
  return MOBILE_CUSTOM_PATHS.has(pathname);
}

export function resolveMobileRoute(pathname: string, searchParams?: URLSearchParams): MobileRouteMeta {
  if (pathname === "/coming-soon" && searchParams?.get("title")) {
    return { title: searchParams.get("title")!, backHref: "/services" };
  }

  if (pathname === "/services" && searchParams?.get("view") === "menu-settings") {
    return { title: "ตั้งค่าเมนูของฉัน", backHref: "/services" };
  }

  if (pathname === "/leave" && searchParams?.get("view") === "overview") {
    return { title: "วันลาพนักงาน", backHref: "/services" };
  }

  if (pathname === "/kpi" && searchParams?.get("view") === "org") {
    return { title: "KPI องค์กร", backHref: "/services" };
  }

  if (pathname === "/reports" && searchParams?.get("view") === "attendance") {
    return { title: "เข้างานทั้งบริษัท", backHref: "/services" };
  }

  const exact = EXACT[pathname];
  if (exact) return exact;

  for (const { pattern, meta } of PATTERNS) {
    if (pattern.test(pathname)) return meta;
  }

  const segment = pathname.split("/").filter(Boolean).pop();
  const fallbackTitle = segment ? decodeURIComponent(segment) : "GV One";
  return { title: fallbackTitle, backHref: "/services" };
}
