import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  employees,
  leaveBalances,
  holidays,
  notifications,
  payrollRecords,
  performanceRecords,
  leaveRequests,
  attendanceRecords,
  workplaces,
} from "./schema";
import { randomBytes } from "crypto";

const DEMO_PASSWORD = "Passw0rd!";

function qrToken() {
  return "GVHR-" + randomBytes(6).toString("hex");
}

export async function runSeed(): Promise<string[]> {
  const log: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    log.push(args.map(String).join(" "));
    origLog(...args);
  };
  try {
    await main();
  } finally {
    console.log = origLog;
  }
  return log;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("Seeding workplaces...");
  const seededWorkplaces = await db
    .insert(workplaces)
    .values([
      { name: "สำนักงานใหญ่ Gadget Villa", lat: 13.7563, lng: 100.5018, radiusMeters: 100, qrToken: qrToken() },
      { name: "คลังสินค้า Gadget Villa", lat: 13.7455, lng: 100.5372, radiusMeters: 150, qrToken: qrToken() },
      { name: "สาขาย่อย", lat: 13.7307, lng: 100.5418, radiusMeters: 80, qrToken: qrToken() },
    ])
    .returning();
  for (const w of seededWorkplaces) {
    console.log(`  ${w.name}: qrToken=${w.qrToken}`);
  }

  console.log("Seeding employees...");
  const [hr, manager, natthapong, sudarat, apiwat] = await db
    .insert(employees)
    .values([
      {
        employeeCode: "EMP-1001",
        name: "ปิยะดา รัตนากร",
        email: "piyada@gadgetvilla.co.th",
        passwordHash,
        role: "hr",
        department: "ฝ่ายบุคคล",
        position: "ผู้จัดการฝ่ายบุคคล",
        phone: "081-234-5601",
        startDate: "2019-04-01",
      },
      {
        employeeCode: "EMP-1002",
        name: "สมชาย ทองดี",
        email: "somchai@gadgetvilla.co.th",
        passwordHash,
        role: "manager",
        department: "คลังสินค้า",
        position: "หัวหน้าคลังสินค้า",
        phone: "081-234-5602",
        startDate: "2020-02-01",
      },
      {
        employeeCode: "EMP-1042",
        name: "ณัฐพงษ์ วิริยะกุล",
        email: "natthapong@gadgetvilla.co.th",
        passwordHash,
        role: "employee",
        department: "คลังสินค้า · Picking",
        position: "เจ้าหน้าที่คลังสินค้า",
        phone: "08x-xxx-4210",
        startDate: "2022-03-03",
      },
      {
        employeeCode: "EMP-1055",
        name: "สุดารัตน์ พงศ์ไพบูลย์",
        email: "sudarat@gadgetvilla.co.th",
        passwordHash,
        role: "employee",
        department: "ฝ่ายขาย",
        position: "เจ้าหน้าที่ฝ่ายขาย",
        phone: "081-234-5605",
        startDate: "2021-06-15",
      },
      {
        employeeCode: "EMP-1063",
        name: "อภิวัฒน์ ศรีสมบัติ",
        email: "apiwat@gadgetvilla.co.th",
        passwordHash,
        role: "employee",
        department: "ไอที",
        position: "เจ้าหน้าที่ไอที",
        phone: "081-234-5606",
        startDate: "2021-09-01",
      },
    ])
    .returning();

  console.log("Wiring manager relationships...");
  await db.update(employees).set({ managerId: manager.id }).where(eq(employees.id, natthapong.id));
  await db.update(employees).set({ managerId: hr.id }).where(eq(employees.id, manager.id));
  await db.update(employees).set({ managerId: hr.id }).where(eq(employees.id, sudarat.id));
  await db.update(employees).set({ managerId: hr.id }).where(eq(employees.id, apiwat.id));

  console.log("Seeding leave balances...");
  const year = new Date().getFullYear() + 543;
  const balanceSeed = [
    { key: "annual", label: "พักร้อน", total: 10, used: 4 },
    { key: "sick", label: "ลาป่วย", total: 30, used: 2 },
    { key: "personal", label: "ลากิจ", total: 6, used: 1 },
  ];
  const usedOverrides: Record<number, Record<string, number>> = {
    [natthapong.id]: { annual: 4, sick: 2, personal: 1 },
    [apiwat.id]: { sick: 1 },
  };
  for (const emp of [natthapong, sudarat, apiwat, manager, hr]) {
    await db.insert(leaveBalances).values(
      balanceSeed.map((b) => ({
        employeeId: emp.id,
        year,
        leaveKey: b.key,
        label: b.label,
        totalDays: b.total,
        usedDays: usedOverrides[emp.id]?.[b.key] ?? 0,
      }))
    );
  }

  console.log("Seeding leave requests...");
  await db.insert(leaveRequests).values([
    {
      requestCode: "REQ-2041",
      employeeId: natthapong.id,
      type: "sick",
      dateFrom: "2026-07-12",
      dateTo: "2026-07-12",
      reason: "ไม่สบาย มีไข้",
      status: "Approved",
      approverId: manager.id,
      submittedAt: new Date("2026-07-10T09:00:00+07:00"),
      decidedAt: new Date("2026-07-10T14:00:00+07:00"),
    },
    {
      requestCode: "REQ-2038",
      employeeId: natthapong.id,
      type: "ot",
      dateFrom: "2026-07-08",
      dateTo: "2026-07-08",
      reason: "เร่งจัดของช่วงโปรโมชั่น",
      status: "Pending",
      approverId: manager.id,
      submittedAt: new Date("2026-07-07T09:00:00+07:00"),
    },
    {
      requestCode: "REQ-2035",
      employeeId: natthapong.id,
      type: "correction",
      dateFrom: "2026-07-05",
      dateTo: "2026-07-05",
      reason: "ลืมลงเวลาออกงาน",
      status: "Rejected",
      approverId: manager.id,
      submittedAt: new Date("2026-07-05T18:30:00+07:00"),
      decidedAt: new Date("2026-07-06T09:00:00+07:00"),
    },
    {
      requestCode: "REQ-2030",
      employeeId: natthapong.id,
      type: "annual",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-02",
      reason: "ธุระครอบครัว",
      status: "Approved",
      approverId: manager.id,
      submittedAt: new Date("2026-06-25T09:00:00+07:00"),
      decidedAt: new Date("2026-06-25T15:00:00+07:00"),
    },
    {
      requestCode: "REQ-2050",
      employeeId: sudarat.id,
      type: "annual",
      dateFrom: "2026-07-20",
      dateTo: "2026-07-21",
      reason: "พักผ่อนต่างจังหวัด",
      status: "Pending",
      approverId: hr.id,
      submittedAt: new Date("2026-07-15T10:00:00+07:00"),
    },
    {
      requestCode: "REQ-2048",
      employeeId: apiwat.id,
      type: "sick",
      dateFrom: "2026-07-14",
      dateTo: "2026-07-14",
      reason: "ปวดหัวไมเกรน",
      status: "Approved",
      approverId: hr.id,
      submittedAt: new Date("2026-07-14T08:30:00+07:00"),
      decidedAt: new Date("2026-07-14T09:00:00+07:00"),
    },
  ]);

  console.log("Seeding holidays...");
  await db.insert(holidays).values([
    { dateISO: "2026-01-01", name: "วันขึ้นปีใหม่", type: "national", notifyEnabled: true },
    { dateISO: "2026-02-17", name: "วันมาฆบูชา", type: "national", notifyEnabled: true },
    { dateISO: "2026-04-06", name: "วันจักรี", type: "national", notifyEnabled: false },
    { dateISO: "2026-04-13", name: "วันสงกรานต์", type: "national", notifyEnabled: true },
    { dateISO: "2026-05-01", name: "วันแรงงานแห่งชาติ", type: "national", notifyEnabled: true },
    {
      dateISO: "2026-08-15",
      name: "วันครบรอบก่อตั้ง Gadget Villa",
      type: "company",
      notifyEnabled: true,
    },
    { dateISO: "2026-12-31", name: "วันสิ้นปี", type: "national", notifyEnabled: true },
  ]);

  console.log("Seeding notifications...");
  await db.insert(notifications).values([
    {
      employeeId: natthapong.id,
      icon: "check_circle",
      color: "#0f9d6e",
      bg: "#e7f8f0",
      title: "อนุมัติการลาป่วยแล้ว",
      body: "คำขอ REQ-2041 ได้รับการอนุมัติโดยหัวหน้างาน",
      isRead: false,
    },
    {
      employeeId: natthapong.id,
      icon: "payments",
      color: "#17181c",
      bg: "#eef7cc",
      title: "สลิปเงินเดือนพร้อมแล้ว",
      body: "สลิปงวดมิถุนายน 2568 พร้อมให้ดาวน์โหลดแล้ว",
      isRead: false,
    },
    {
      employeeId: natthapong.id,
      icon: "cancel",
      color: "#d64545",
      bg: "#fdecec",
      title: "คำขอแก้ไขเวลาไม่ผ่าน",
      body: "REQ-2035 ไม่ได้รับการอนุมัติ กรุณาติดต่อ HR",
      isRead: true,
    },
    {
      employeeId: natthapong.id,
      icon: "campaign",
      color: "#b7791f",
      bg: "#fff7e6",
      title: "รอบประเมินผลงาน Q3 เริ่มแล้ว",
      body: "กรุณาทำแบบประเมินตนเองภายใน 31 ก.ค. 2568",
      isRead: true,
    },
  ]);

  console.log("Seeding payroll records for all employees...");
  const periods = [
    { period: "2568-03", label: "มีนาคม 2568" },
    { period: "2568-04", label: "เมษายน 2568" },
    { period: "2568-05", label: "พฤษภาคม 2568" },
    { period: "2568-06", label: "มิถุนายน 2568" },
  ];
  const baseSalaryByEmp: Record<number, number> = {
    [hr.id]: 45000,
    [manager.id]: 38000,
    [natthapong.id]: 22000,
    [sudarat.id]: 26000,
    [apiwat.id]: 30000,
  };
  for (const emp of [hr, manager, natthapong, sudarat, apiwat]) {
    const base = baseSalaryByEmp[emp.id];
    for (const p of periods) {
      const ot = Math.round(base * 0.06);
      const allowance = Math.round(base * 0.045);
      const positionAllowance = Math.round(base * 0.07);
      const earnings = [
        { label: "เงินเดือนพื้นฐาน", amt: base },
        { label: "ค่าล่วงเวลา (OT)", amt: ot },
        { label: "เบี้ยขยัน", amt: allowance },
        { label: "ค่าตำแหน่ง", amt: positionAllowance },
      ];
      const socialSecurity = Math.min(750, Math.round(base * 0.05));
      const deductions = [
        { label: "ประกันสังคม", amt: socialSecurity },
        { label: "ภาษีหัก ณ ที่จ่าย", amt: base > 30000 ? Math.round(base * 0.03) : 0 },
        { label: "มาสาย/ขาดงาน", amt: 0 },
        { label: "เงินกู้สวัสดิการ", amt: 0 },
      ];
      const gross = earnings.reduce((a, b) => a + b.amt, 0);
      const totalDeductions = deductions.reduce((a, b) => a + b.amt, 0);
      await db.insert(payrollRecords).values({
        employeeId: emp.id,
        period: p.period,
        periodLabel: p.label,
        earnings,
        deductions,
        gross,
        totalDeductions,
        net: gross - totalDeductions,
        paidAt: new Date(),
      });
    }
  }

  console.log("Seeding attendance history for all employees...");
  const today = new Date();
  for (const emp of [hr, manager, natthapong, sudarat, apiwat]) {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const workDate = d.toISOString().slice(0, 10);
      const late = Math.random() < 0.12;
      const absent = Math.random() < 0.03;
      if (absent) {
        await db.insert(attendanceRecords).values({ employeeId: emp.id, workDate });
        continue;
      }
      const clockIn = new Date(d);
      clockIn.setHours(late ? 9 : 8, late ? 10 + Math.floor(Math.random() * 20) : 45 + Math.floor(Math.random() * 14), 0, 0);
      const clockOut = new Date(d);
      clockOut.setHours(18, Math.floor(Math.random() * 20), 0, 0);
      await db.insert(attendanceRecords).values({
        employeeId: emp.id,
        workDate,
        clockInAt: clockIn,
        clockOutAt: clockOut,
        clockInLat: 13.7563,
        clockInLng: 100.5018,
        clockOutLat: 13.7563,
        clockOutLng: 100.5018,
      });
    }
  }

  console.log("Seeding performance records...");
  await db.insert(performanceRecords).values({
    employeeId: natthapong.id,
    cycle: "ครึ่งปีแรก 2568",
    overallScore: 4.2,
    band: "ดีเยี่ยม (Exceeds)",
    kpis: [
      { label: "Productivity · หยิบสินค้า/ชม.", score: 4.5 },
      { label: "Accuracy · ความแม่นยำ", score: 4.3 },
      { label: "Attendance · การมาทำงาน", score: 3.8 },
      { label: "Teamwork · การทำงานเป็นทีม", score: 4.4 },
    ],
    competencies: [
      { label: "การสื่อสาร", cur: 3, tgt: 4 },
      { label: "การแก้ปัญหา", cur: 4, tgt: 4 },
      { label: "ความรับผิดชอบ", cur: 5, tgt: 5 },
      { label: "การเรียนรู้", cur: 3, tgt: 4 },
    ],
    idpTitle: "พัฒนาทักษะการสื่อสาร",
    idpDescription: "อบรม + โค้ชรายเดือน",
    idpTargetDate: "ก.ย. 2568",
    idpProgressPercent: 60,
  });

  console.log("Seed complete.");
  console.log(`Demo login password for all accounts: ${DEMO_PASSWORD}`);
  console.log(
    [hr, manager, natthapong, sudarat, apiwat]
      .map((e) => `  ${e.employeeCode}  ${e.email}  (${e.role})`)
      .join("\n")
  );
}

