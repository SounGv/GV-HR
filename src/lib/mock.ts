import type {
  AiEmployee,
  HolidayItem,
  LeaveRequest,
  LeaveTypeKey,
  ReportTab,
  RequestStatus,
} from "./types";

export const employeeName = "ณัฐพงษ์ วิริยะกุล";
export const employeeDept = "คลังสินค้า · Picking";
export const employeeRole = "เจ้าหน้าที่คลังสินค้า";

export const statusMeta: Record<
  RequestStatus,
  { th: string; bg: string; fg: string; dot: string }
> = {
  Pending: { th: "รออนุมัติ", bg: "#fff7e6", fg: "#b7791f", dot: "#f59e0b" },
  Approved: { th: "อนุมัติแล้ว", bg: "#e7f8f0", fg: "#0f9d6e", dot: "#10b981" },
  Rejected: { th: "ไม่อนุมัติ", bg: "#fdecec", fg: "#d64545", dot: "#ef4444" },
  Cancelled: { th: "ยกเลิก", bg: "#f1f2f5", fg: "#7b7d8c", dot: "#9aa0ab" },
};

export const requestIconMap: Record<LeaveTypeKey, { icon: string; bg: string; fg: string }> = {
  annual: { icon: "beach_access", bg: "#eef7cc", fg: "#17181c" },
  sick: { icon: "sick", bg: "#e7f8f0", fg: "#0f9d6e" },
  personal: { icon: "event_busy", bg: "#fff7e6", fg: "#b7791f" },
  unpaid: { icon: "money_off", bg: "#f1f2f5", fg: "#7b7d8c" },
  ot: { icon: "more_time", bg: "#eef7cc", fg: "#3a3c46" },
  correction: { icon: "edit_calendar", bg: "#fdeee4", fg: "#e8590c" },
};

export const leaveTypeName: Record<LeaveTypeKey, string> = {
  annual: "ลาพักร้อน",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  unpaid: "ลาไม่รับค่าจ้าง",
  ot: "ทำงานล่วงเวลา",
  correction: "ขอแก้ไขเวลา",
};

export const leaveTypeDefs: {
  key: LeaveTypeKey;
  label: string;
  en: string;
  icon: string;
  bg: string;
  color: string;
}[] = [
  { key: "annual", label: "ลาพักร้อน", en: "Annual", icon: "beach_access", bg: "#eef7cc", color: "#17181c" },
  { key: "sick", label: "ลาป่วย", en: "Sick", icon: "sick", bg: "#e7f8f0", color: "#0f9d6e" },
  { key: "personal", label: "ลากิจ", en: "Personal", icon: "event_busy", bg: "#fff7e6", color: "#b7791f" },
  { key: "unpaid", label: "ลาไม่รับค่าจ้าง", en: "Unpaid", icon: "money_off", bg: "#f1f2f5", color: "#7b7d8c" },
  { key: "ot", label: "ทำงานล่วงเวลา", en: "Overtime", icon: "more_time", bg: "#eef7cc", color: "#3a3c46" },
  { key: "correction", label: "ขอแก้ไขเวลา", en: "Correction", icon: "edit_calendar", bg: "#fdeee4", color: "#e8590c" },
];

export const initialRequests: LeaveRequest[] = [
  { id: "REQ-2041", type: "ลาป่วย", key: "sick", dateLabel: "12 ก.ค. 2568", sub: "1 วัน", status: "Approved", submitted: "10 ก.ค." },
  { id: "REQ-2038", type: "ทำงานล่วงเวลา", key: "ot", dateLabel: "8 ก.ค. 2568", sub: "3 ชม.", status: "Pending", submitted: "7 ก.ค." },
  { id: "REQ-2035", type: "ขอแก้ไขเวลา", key: "correction", dateLabel: "5 ก.ค. 2568", sub: "ลืมลงเวลาออก", status: "Rejected", submitted: "5 ก.ค." },
  { id: "REQ-2030", type: "ลาพักร้อน", key: "annual", dateLabel: "1–2 ก.ค. 2568", sub: "2 วัน", status: "Approved", submitted: "25 มิ.ย." },
];

export const initialHolidays: HolidayItem[] = [
  { id: 1, dateISO: "2026-01-01", name: "วันขึ้นปีใหม่", type: "นักขัตฤกษ์", notify: true },
  { id: 2, dateISO: "2026-02-17", name: "วันมาฆบูชา", type: "นักขัตฤกษ์", notify: true },
  { id: 3, dateISO: "2026-04-06", name: "วันจักรี", type: "นักขัตฤกษ์", notify: false },
  { id: 4, dateISO: "2026-04-13", name: "วันสงกรานต์", type: "นักขัตฤกษ์", notify: true },
  { id: 5, dateISO: "2026-05-01", name: "วันแรงงานแห่งชาติ", type: "นักขัตฤกษ์", notify: true },
  { id: 6, dateISO: "2026-08-15", name: "วันครบรอบก่อตั้ง Gadget Villa", type: "วันหยุดบริษัท", notify: true },
  { id: 7, dateISO: "2026-12-31", name: "วันสิ้นปี", type: "นักขัตฤกษ์", notify: true },
];

export const leaveBalanceSeed = [
  { label: "พักร้อน", used: 4, total: 10, color: "#17181c" },
  { label: "ลาป่วย", used: 2, total: 30, color: "#10b981" },
  { label: "ลากิจ", used: 1, total: 6, color: "#f59e0b" },
];

export const notificationSeed = [
  { id: "n1", icon: "check_circle", color: "#0f9d6e", bg: "#e7f8f0", title: "อนุมัติการลาป่วยแล้ว", body: "คำขอ REQ-2041 ได้รับการอนุมัติโดยหัวหน้างาน", time: "2 ชม." },
  { id: "n2", icon: "payments", color: "#17181c", bg: "#eef7cc", title: "สลิปเงินเดือนพร้อมแล้ว", body: "สลิปงวดมิถุนายน 2568 พร้อมให้ดาวน์โหลดแล้ว", time: "1 วัน" },
  { id: "n3", icon: "cancel", color: "#d64545", bg: "#fdecec", title: "คำขอแก้ไขเวลาไม่ผ่าน", body: "REQ-2035 ไม่ได้รับการอนุมัติ กรุณาติดต่อ HR", time: "2 วัน" },
  { id: "n4", icon: "campaign", color: "#b7791f", bg: "#fff7e6", title: "รอบประเมินผลงาน Q3 เริ่มแล้ว", body: "กรุณาทำแบบประเมินตนเองภายใน 31 ก.ค. 2568", time: "3 วัน" },
];

export const attStats = [
  { label: "มาทำงาน", value: "18", color: "#0f9d6e" },
  { label: "สาย", value: "2", color: "#f59e0b" },
  { label: "ขาด", value: "1", color: "#ef4444" },
  { label: "OT (ชม.)", value: "6", color: "#17181c" },
];

export const attHistory = [
  { day: "จ", dnum: "14", date: "14 ก.ค. 2568", in: "08:56", out: "18:05", status: "ปกติ", color: "#0f9d6e" },
  { day: "ศ", dnum: "11", date: "11 ก.ค. 2568", in: "09:12", out: "18:02", status: "สาย 12 น.", color: "#f59e0b" },
  { day: "พฤ", dnum: "10", date: "10 ก.ค. 2568", in: "08:49", out: "18:10", status: "ปกติ", color: "#0f9d6e" },
  { day: "พ", dnum: "9", date: "9 ก.ค. 2568", in: "08:58", out: "—", status: "ลืมลงเวลาออก", color: "#ef4444" },
  { day: "อ", dnum: "8", date: "8 ก.ค. 2568", in: "08:52", out: "18:30", status: "ปกติ +OT", color: "#0f9d6e" },
  { day: "จ", dnum: "7", date: "7 ก.ค. 2568", in: "—", out: "—", status: "ลาป่วย", color: "#7b7d8c" },
];

export const earningsSeed = [
  { label: "เงินเดือนพื้นฐาน", amt: 22000 },
  { label: "ค่าล่วงเวลา (OT)", amt: 2400 },
  { label: "เบี้ยขยัน", amt: 1000 },
  { label: "ค่าตำแหน่ง", amt: 1500 },
];

export const deductionsSeed = [
  { label: "ประกันสังคม", amt: 750 },
  { label: "ภาษีหัก ณ ที่จ่าย", amt: 0 },
  { label: "มาสาย/ขาดงาน", amt: 200 },
  { label: "เงินกู้สวัสดิการ", amt: 1100 },
];

export const payHistorySeed = [
  { period: "พฤษภาคม 2568", net: 24100 },
  { period: "เมษายน 2568", net: 23980 },
  { period: "มีนาคม 2568", net: 25200 },
];

export const kpiSeed = [
  { label: "Productivity · หยิบสินค้า/ชม.", score: 4.5 },
  { label: "Accuracy · ความแม่นยำ", score: 4.3 },
  { label: "Attendance · การมาทำงาน", score: 3.8 },
  { label: "Teamwork · การทำงานเป็นทีม", score: 4.4 },
];

export const compSeed = [
  { label: "การสื่อสาร", cur: 3, tgt: 4 },
  { label: "การแก้ปัญหา", cur: 4, tgt: 4 },
  { label: "ความรับผิดชอบ", cur: 5, tgt: 5 },
  { label: "การเรียนรู้", cur: 3, tgt: 4 },
];

export const aiDeptDefs = ["บริหาร", "ฝ่ายขาย", "การตลาด", "คลังสินค้า", "บัญชี", "จัดซื้อ", "บริการลูกค้า", "ไอที"];

export const aiEmpDefs: AiEmployee[] = [
  { name: "ณัฐพงษ์ วิริยะกุล", dept: "คลังสินค้า", scores: "Productivity 4.5/5, Accuracy 4.3/5, Attendance 3.8/5, Teamwork 4.4/5" },
  { name: "สุดารัตน์ พงศ์ไพบูลย์", dept: "ฝ่ายขาย", scores: "ยอดขาย 112% ของเป้า, ลูกค้าใหม่ 4.0/5, Conversion 3.6/5" },
  { name: "อภิวัฒน์ ศรีสมบัติ", dept: "ไอที", scores: "Uptime 4.8/5, การแก้ปัญหา 4.2/5, การสื่อสาร 3.4/5" },
];

export const profileRows = (empDept: string) => [
  { label: "รหัสพนักงาน", value: "EMP-1042" },
  { label: "แผนก", value: empDept },
  { label: "ตำแหน่ง", value: "เจ้าหน้าที่คลังสินค้า" },
  { label: "หัวหน้างาน", value: "สมชาย ทองดี" },
  { label: "ประเภทการจ้าง", value: "พนักงานประจำ" },
  { label: "วันเริ่มงาน", value: "3 มี.ค. 2565" },
  { label: "อีเมล", value: "natthapong@gadgetvilla.co.th" },
  { label: "เบอร์โทร", value: "08x-xxx-4210" },
];

export const reportMeta: Record<ReportTab, { c: string; bg: string }> = {
  attendance: { c: "#0f9d6e", bg: "#e7f8f0" },
  leave: { c: "#3a3c46", bg: "#eef7cc" },
  finance: { c: "#0f766e", bg: "#e3f4f1" },
};

export const reportSets: Record<
  ReportTab,
  {
    title: string;
    updated: string;
    cards: { label: string; value: string; color: string }[];
    rows: { name: string; val: string; p: number }[];
  }
> = {
  attendance: {
    title: "อัตราการมาทำงานตามแผนก",
    updated: "เดือนกรกฎาคม 2569",
    cards: [
      { label: "อัตรามาทำงาน", value: "96.2%", color: "#0f9d6e" },
      { label: "มาสาย", value: "34 ครั้ง", color: "#f59e0b" },
      { label: "ขาดงาน", value: "5 ครั้ง", color: "#ef4444" },
      { label: "ชั่วโมง OT", value: "412 ชม.", color: "#17181c" },
    ],
    rows: [
      { name: "บัญชี", val: "99%", p: 99 },
      { name: "การตลาด", val: "98%", p: 98 },
      { name: "ฝ่ายขาย", val: "97%", p: 97 },
      { name: "จัดซื้อ", val: "96%", p: 96 },
      { name: "ไอที", val: "95%", p: 95 },
      { name: "คลังสินค้า", val: "94%", p: 94 },
      { name: "บริการลูกค้า", val: "93%", p: 93 },
    ],
  },
  leave: {
    title: "จำนวนวันลาตามแผนก",
    updated: "เดือนกรกฎาคม 2569",
    cards: [
      { label: "วันลารวม", value: "86 วัน", color: "#3a3c46" },
      { label: "ลาพักร้อน", value: "42 วัน", color: "#17181c" },
      { label: "ลาป่วย", value: "31 วัน", color: "#0f9d6e" },
      { label: "รออนุมัติ", value: "7 คำขอ", color: "#f59e0b" },
    ],
    rows: [
      { name: "ฝ่ายขาย", val: "21 วัน", p: 100 },
      { name: "คลังสินค้า", val: "18 วัน", p: 86 },
      { name: "การตลาด", val: "14 วัน", p: 67 },
      { name: "บริการลูกค้า", val: "12 วัน", p: 57 },
      { name: "บัญชี", val: "9 วัน", p: 43 },
      { name: "จัดซื้อ", val: "7 วัน", p: 33 },
      { name: "ไอที", val: "5 วัน", p: 24 },
    ],
  },
  finance: {
    title: "ต้นทุนค่าจ้างตามแผนก",
    updated: "งวดมิถุนายน 2569",
    cards: [
      { label: "ค่าจ้างรวม", value: "฿3.24M", color: "#0f766e" },
      { label: "ค่า OT", value: "฿186K", color: "#17181c" },
      { label: "โบนัส/เบี้ย", value: "฿240K", color: "#f59e0b" },
      { label: "เงินเดือนเฉลี่ย", value: "฿25.3K", color: "#0f9d6e" },
    ],
    rows: [
      { name: "ฝ่ายขาย", val: "฿742K", p: 100 },
      { name: "คลังสินค้า", val: "฿638K", p: 86 },
      { name: "บริการลูกค้า", val: "฿486K", p: 65 },
      { name: "การตลาด", val: "฿412K", p: 56 },
      { name: "บัญชี", val: "฿358K", p: 48 },
      { name: "ไอที", val: "฿332K", p: 45 },
      { name: "จัดซื้อ", val: "฿272K", p: 37 },
    ],
  },
};

export const moreMenuDefs = [
  { key: "aieval", label: "AI ช่วยประเมิน", sub: "ออกแบบเกณฑ์ · ร่างผลประเมิน", icon: "auto_awesome", bg: "#eef7cc", color: "#17181c" },
  { key: "holidays", label: "วันหยุดบริษัท", sub: "กำหนดโดย HR · แจ้งเตือน", icon: "event", bg: "#eef7cc", color: "#17181c" },
  { key: "reports", label: "รายงาน (HR · บัญชี)", sub: "เวลางาน · การลา · การเงิน", icon: "summarize", bg: "#eef7cc", color: "#17181c" },
  { key: "perf", label: "ผลการปฏิบัติงาน", sub: "KPI · สมรรถนะ · IDP", icon: "trending_up", bg: "#e7f8f0", color: "#0f9d6e" },
  { key: "leave", label: "การลา", sub: "ขอลา · วันลาคงเหลือ", icon: "beach_access", bg: "#eef7cc", color: "#17181c" },
  { key: "calendar", label: "ปฏิทินบริษัท", sub: "วันหยุด · กิจกรรม", icon: "calendar_month", bg: "#fff7e6", color: "#b7791f" },
  { key: "docs", label: "เอกสาร", sub: "สลิป · หนังสือรับรอง", icon: "folder", bg: "#fdeee4", color: "#e8590c" },
  { key: "notifs", label: "การแจ้งเตือน", sub: "ทั้งหมด", icon: "notifications", bg: "#f1f2f5", color: "#5a5d6b" },
  { key: "settings", label: "ตั้งค่า", sub: "บัญชี · ภาษา · ความเป็นส่วนตัว", icon: "settings", bg: "#f1f2f5", color: "#5a5d6b" },
] as const;

export const tabDefs: { key: import("./types").TabKey; icon: string; label: string }[] = [
  { key: "home", icon: "home", label: "หน้าหลัก" },
  { key: "attendance", icon: "schedule", label: "เวลางาน" },
  { key: "requests", icon: "assignment", label: "คำขอ" },
  { key: "payroll", icon: "payments", label: "เงินเดือน" },
  { key: "more", icon: "grid_view", label: "เพิ่มเติม" },
];
