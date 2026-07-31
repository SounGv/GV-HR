import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_PRESETS, expandPermissions } from "../src/config/permissions";
import { computePayroll, periodLabel } from "../src/features/payroll/calc";
import { computeOverall, scoreBand } from "../src/features/performance/calc";

const prisma = new PrismaClient();

// Stable IDs so re-seeding is idempotent.
const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const HQ_ID = "00000000-0000-0000-0000-0000000000b1";

const DEPARTMENTS = [
  { code: "WH", name: "คลังสินค้า" },
  { code: "SALES", name: "ฝ่ายขาย" },
  { code: "MKT", name: "การตลาด" },
  { code: "FIN", name: "บัญชีและการเงิน" },
  { code: "IT", name: "IT & Support" },
  { code: "HR", name: "ทรัพยากรบุคคล" },
];

async function main() {
  console.log("▶ Seeding NEXA…");

  const passwordHash = await bcrypt.hash("Password123!", 12);

  // 1) Company
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      name: "NEXA Demo Co., Ltd.",
      legalName: "บริษัท เน็กซ่า เดโม จำกัด",
      timezone: "Asia/Bangkok",
      currency: "THB",
    },
  });

  // 2) Permissions (global catalog)
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, label: p.label },
      create: { key: p.key, module: p.module, action: p.action, label: p.label },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} permissions`);

  // 3) Roles + role-permissions
  const roleByName = new Map<string, string>();
  for (const preset of ROLE_PRESETS) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId: COMPANY_ID, name: preset.name } },
      update: { description: preset.description, isSystem: preset.isSystem },
      create: {
        companyId: COMPANY_ID,
        name: preset.name,
        description: preset.description,
        isSystem: preset.isSystem,
      },
    });
    roleByName.set(preset.name, role.id);

    const keys = expandPermissions(preset.permissions);
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });
    // Reset then reconnect (keeps preset authoritative).
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ ${ROLE_PRESETS.length} roles`);

  // 4) Branch (HQ) with geofence
  await prisma.branch.upsert({
    where: { id: HQ_ID },
    update: {},
    create: {
      id: HQ_ID,
      companyId: COMPANY_ID,
      name: "สำนักงานใหญ่ กรุงเทพ",
      code: "HQ",
      address: "กรุงเทพมหานคร",
      lat: 13.7563,
      lng: 100.5018,
      radiusMeters: 150,
    },
  });

  // 5) Departments
  const deptByCode = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { companyId_code: { companyId: COMPANY_ID, code: d.code } },
      update: { name: d.name },
      create: { companyId: COMPANY_ID, code: d.code, name: d.name, branchId: HQ_ID },
    });
    deptByCode.set(d.code, dept.id);
  }
  console.log(`  ✓ ${DEPARTMENTS.length} departments`);

  // 6) Positions
  const positions = [
    { code: "HR-MGR", title: "ผู้จัดการฝ่ายบุคคล", level: 5, dept: "HR" },
    { code: "SALE-MGR", title: "ผู้จัดการฝ่ายขาย", level: 5, dept: "SALES" },
    { code: "SALE-STAFF", title: "พนักงานขาย", level: 2, dept: "SALES" },
    { code: "WH-STAFF", title: "พนักงานคลังสินค้า", level: 2, dept: "WH" },
    { code: "FIN-STAFF", title: "เจ้าหน้าที่การเงิน", level: 3, dept: "FIN" },
  ];
  const posByCode = new Map<string, string>();
  for (const p of positions) {
    const pos = await prisma.position.upsert({
      where: { companyId_code: { companyId: COMPANY_ID, code: p.code } },
      update: { title: p.title, level: p.level },
      create: {
        companyId: COMPANY_ID,
        code: p.code,
        title: p.title,
        level: p.level,
        departmentId: deptByCode.get(p.dept),
      },
    });
    posByCode.set(p.code, pos.id);
  }

  // 7) Users + Employees
  const people: Array<{
    code: string;
    email: string;
    firstName: string;
    lastName: string;
    nickname?: string;
    role: string;
    dept: string;
    pos: string;
  }> = [
    { code: "EMP0001", email: "admin@nexa.co.th", firstName: "แอดมิน", lastName: "ระบบ", nickname: "Admin", role: "Super Admin", dept: "IT", pos: "HR-MGR" },
    { code: "EMP0002", email: "hr@nexa.co.th", firstName: "สุนทร", lastName: "ใจดี", nickname: "สุนทร", role: "HR Manager", dept: "HR", pos: "HR-MGR" },
    { code: "EMP0003", email: "manager@nexa.co.th", firstName: "วราภรณ์", lastName: "คำสิงห์", nickname: "แนน", role: "Manager", dept: "SALES", pos: "SALE-MGR" },
    { code: "EMP0004", email: "employee@nexa.co.th", firstName: "ธนพล", lastName: "ศรีสุข", nickname: "พล", role: "Employee", dept: "SALES", pos: "SALE-STAFF" },
    { code: "EMP0005", email: "finance@nexa.co.th", firstName: "ณัฐชูณิ", lastName: "ใจดี", nickname: "หนิง", role: "Finance", dept: "FIN", pos: "FIN-STAFF" },
  ];

  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId: COMPANY_ID, email: person.email } },
      update: {},
      create: {
        companyId: COMPANY_ID,
        email: person.email,
        passwordHash,
        status: "ACTIVE",
      },
    });

    // Assign role
    const roleId = roleByName.get(person.role)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId } },
      update: {},
      create: { userId: user.id, roleId },
    });

    // Employee record linked to the user
    await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId: COMPANY_ID, employeeCode: person.code } },
      update: {
        firstName: person.firstName,
        lastName: person.lastName,
        nickname: person.nickname,
        userId: user.id,
      },
      create: {
        companyId: COMPANY_ID,
        userId: user.id,
        employeeCode: person.code,
        firstName: person.firstName,
        lastName: person.lastName,
        nickname: person.nickname,
        email: person.email,
        branchId: HQ_ID,
        departmentId: deptByCode.get(person.dept),
        positionId: posByCode.get(person.pos),
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        hireDate: new Date("2023-01-15"),
        baseSalary: new Prisma.Decimal(35000),
      },
    });
  }
  console.log(`  ✓ ${people.length} users + employees`);

  // 8) Holidays (current year)
  const year = new Date().getFullYear();
  const HOLIDAYS = [
    { m: 0, d: 1, name: "วันขึ้นปีใหม่", type: "NATIONAL" as const },
    { m: 3, d: 13, name: "วันสงกรานต์", type: "NATIONAL" as const },
    { m: 3, d: 14, name: "วันสงกรานต์ (วันครอบครัว)", type: "NATIONAL" as const },
    { m: 3, d: 15, name: "วันสงกรานต์", type: "NATIONAL" as const },
    { m: 4, d: 1, name: "วันแรงงานแห่งชาติ", type: "NATIONAL" as const },
    { m: 6, d: 15, name: "วันหยุดกลางปีบริษัท", type: "COMPANY" as const },
    { m: 11, d: 5, name: "วันคล้ายวันพระบรมราชสมภพ ร.9", type: "NATIONAL" as const },
    { m: 11, d: 10, name: "วันรัฐธรรมนูญ", type: "NATIONAL" as const },
    { m: 11, d: 31, name: "วันสิ้นปี", type: "NATIONAL" as const },
  ];
  for (const h of HOLIDAYS) {
    const date = new Date(Date.UTC(year, h.m, h.d));
    await prisma.holiday.upsert({
      where: { companyId_date_name: { companyId: COMPANY_ID, date, name: h.name } },
      update: {},
      create: { companyId: COMPANY_ID, date, name: h.name, type: h.type },
    });
  }
  console.log(`  ✓ ${HOLIDAYS.length} holidays (${year})`);

  // 9) Attendance sample for the HR user (last ~12 weekdays). Bangkok = UTC+7,
  //    so 08:55 local = 01:55 UTC, 09:15 local = 02:15 UTC, 18:05 local = 11:05 UTC.
  const hrEmp = await prisma.employee.findUnique({
    where: { companyId_employeeCode: { companyId: COMPANY_ID, employeeCode: "EMP0002" } },
    select: { id: true },
  });
  if (hrEmp) {
    const base = new Date();
    let made = 0;
    for (let i = 1; i <= 20 && made < 12; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i);
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const y = d.getUTCFullYear();
      const mo = d.getUTCMonth();
      const day = d.getUTCDate();
      const late = made % 5 === 4;
      const workDate = new Date(Date.UTC(y, mo, day));
      const clockInAt = new Date(Date.UTC(y, mo, day, late ? 2 : 1, late ? 15 : 55));
      const clockOutAt = new Date(Date.UTC(y, mo, day, 11, 5));
      await prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: hrEmp.id, workDate } },
        update: {},
        create: {
          companyId: COMPANY_ID,
          employeeId: hrEmp.id,
          workDate,
          clockInAt,
          clockOutAt,
          clockInLat: 13.7563,
          clockInLng: 100.5018,
          clockInDistance: 22,
          clockOutLat: 13.7563,
          clockOutLng: 100.5018,
          clockOutDistance: 25,
          clockInBranchId: HQ_ID,
          status: late ? "LATE" : "PRESENT",
        },
      });
      made++;
    }
    console.log(`  ✓ ${made} attendance records (EMP0002)`);
  }

  // 10) Leave balances (current year) for all employees
  const allEmps = await prisma.employee.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true },
  });
  const quotas = [
    { type: "ANNUAL" as const, total: 10 },
    { type: "SICK" as const, total: 30 },
    { type: "PERSONAL" as const, total: 3 },
  ];
  for (const emp of allEmps) {
    for (const q of quotas) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: emp.id, year, type: q.type } },
        update: {},
        create: {
          companyId: COMPANY_ID,
          employeeId: emp.id,
          year,
          type: q.type,
          totalDays: q.total,
          usedDays: 0,
        },
      });
    }
  }
  console.log(`  ✓ leave balances for ${allEmps.length} employees`);

  // 11) Payroll for last month (marked PAID) so employees have a payslip
  const nowP = new Date();
  const lm = new Date(Date.UTC(nowP.getUTCFullYear(), nowP.getUTCMonth() - 1, 1));
  const payPeriod = `${lm.getUTCFullYear()}-${String(lm.getUTCMonth() + 1).padStart(2, "0")}`;
  const payLabel = periodLabel(payPeriod);
  const salaried = await prisma.employee.findMany({
    where: { companyId: COMPANY_ID, status: "ACTIVE", baseSalary: { not: null } },
    select: { id: true, baseSalary: true },
  });
  for (const emp of salaried) {
    const comp = computePayroll(Number(emp.baseSalary));
    await prisma.payrollRecord.upsert({
      where: { employeeId_period: { employeeId: emp.id, period: payPeriod } },
      update: {},
      create: {
        companyId: COMPANY_ID,
        employeeId: emp.id,
        period: payPeriod,
        periodLabel: payLabel,
        earnings: comp.earnings as unknown as Prisma.InputJsonValue,
        deductions: comp.deductions as unknown as Prisma.InputJsonValue,
        gross: comp.gross,
        totalDeductions: comp.totalDeductions,
        net: comp.net,
        status: "PAID",
        paidAt: new Date(),
      },
    });
  }
  console.log(`  ✓ payroll for ${salaried.length} employees (${payPeriod})`);

  // 12) Sample performance review (EMP0004 reviewed by manager EMP0003)
  const staff = await prisma.employee.findUnique({
    where: { companyId_employeeCode: { companyId: COMPANY_ID, employeeCode: "EMP0004" } },
    select: { id: true },
  });
  const mgr = await prisma.employee.findUnique({
    where: { companyId_employeeCode: { companyId: COMPANY_ID, employeeCode: "EMP0003" } },
    select: { id: true, userId: true },
  });
  if (staff && mgr) {
    // Wire the reporting line so team-scoped features work in the demo.
    await prisma.employee.update({ where: { id: staff.id }, data: { managerId: mgr.id } });

    const nowR = new Date();
    const cycle = `H${nowR.getMonth() < 6 ? 1 : 2}/${nowR.getFullYear() + 543}`;
    const comps = [
      { name: "การทำงานเป็นทีม", score: 4 },
      { name: "ความรับผิดชอบ", score: 4.5 },
      { name: "การสื่อสาร", score: 3.5 },
      { name: "คุณภาพงาน", score: 4 },
      { name: "ความคิดริเริ่ม", score: 3.5 },
    ];
    const overall = computeOverall(comps);
    await prisma.performanceReview.upsert({
      where: { employeeId_cycle: { employeeId: staff.id, cycle } },
      update: {},
      create: {
        companyId: COMPANY_ID,
        employeeId: staff.id,
        reviewerEmployeeId: mgr.id,
        reviewerUserId: mgr.userId,
        cycle,
        overallScore: overall,
        band: scoreBand(overall),
        competencies: comps as unknown as Prisma.InputJsonValue,
        strengths: "ทำงานร่วมกับทีมได้ดี มีความรับผิดชอบสูง",
        improvements: "ควรพัฒนาทักษะการนำเสนอและการสื่อสารข้ามทีม",
        summary: "ผลงานโดยรวมอยู่ในระดับดี",
        status: "FINALIZED",
      },
    });
    console.log(`  ✓ sample performance review (${cycle})`);
  }

  // 13) Announcements (only on a fresh company to avoid duplicates)
  const annCount = await prisma.announcement.count({ where: { companyId: COMPANY_ID } });
  if (annCount === 0) {
    const anns = [
      {
        title: "ยินดีต้อนรับสู่ NEXA People Platform",
        body: "ระบบบริหารงานบุคคลและเงินเดือนใหม่พร้อมใช้งานแล้ว พนักงานสามารถเช็คอินด้วย GPS ยื่นลา ดูสลิปเงินเดือน และผลประเมินได้ในที่เดียว",
        pinned: true,
      },
      {
        title: "แจ้งวันหยุดสงกรานต์",
        body: "บริษัทหยุดทำการวันที่ 13–15 เมษายน เนื่องในเทศกาลสงกรานต์ ขอให้ทุกท่านเดินทางปลอดภัย",
        pinned: false,
      },
      {
        title: "นโยบายการทำงานแบบ Hybrid",
        body: "ตั้งแต่เดือนนี้เป็นต้นไป พนักงานสามารถทำงานจากที่บ้านได้ 2 วันต่อสัปดาห์ โดยแจ้งหัวหน้างานล่วงหน้า",
        pinned: false,
      },
    ];
    for (const a of anns) {
      await prisma.announcement.create({
        data: {
          companyId: COMPANY_ID,
          authorEmployeeId: hrEmp?.id ?? null,
          authorName: "สุนทร ใจดี",
          title: a.title,
          body: a.body,
          pinned: a.pinned,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    }
    console.log(`  ✓ ${anns.length} announcements`);
  }

  // 14) Sample OT request (staff EMP0004, PENDING — for the approvals demo)
  if (staff) {
    const otCount = await prisma.overtimeRequest.count({ where: { companyId: COMPANY_ID } });
    if (otCount === 0) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      const otDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      await prisma.overtimeRequest.create({
        data: {
          companyId: COMPANY_ID,
          employeeId: staff.id,
          date: otDate,
          startTime: "18:00",
          endTime: "20:30",
          hours: 2.5,
          multiplier: 1.5,
          estimatedAmount: Math.round((35000 / 30 / 8) * 1.5 * 2.5),
          reason: "ปิดยอดขายสิ้นเดือน",
          status: "PENDING",
        },
      });
      console.log("  ✓ sample OT request");
    }
  }

  // 15) Assets
  const assetCount = await prisma.asset.count({ where: { companyId: COMPANY_ID } });
  if (assetCount === 0) {
    const assets: {
      code: string;
      name: string;
      category: string;
      serial: string | null;
      price: number;
      status: "AVAILABLE" | "ASSIGNED" | "REPAIR" | "RETIRED";
      assignTo?: string;
    }[] = [
      { code: "IT-0001", name: "MacBook Pro 14”", category: "โน้ตบุ๊ก", serial: "C02XL0011", price: 65000, status: "ASSIGNED", assignTo: staff?.id },
      { code: "IT-0002", name: "Dell Latitude 5440", category: "โน้ตบุ๊ก", serial: "DL5440-002", price: 32000, status: "AVAILABLE" },
      { code: "PH-0001", name: "iPhone 15", category: "โทรศัพท์", serial: "IP15-001", price: 29000, status: "AVAILABLE" },
      { code: "FN-0001", name: "เก้าอี้สำนักงาน Ergonomic", category: "เฟอร์นิเจอร์", serial: null, price: 4500, status: "REPAIR" },
    ];
    for (const a of assets) {
      await prisma.asset.create({
        data: {
          companyId: COMPANY_ID,
          assetCode: a.code,
          name: a.name,
          category: a.category,
          serialNumber: a.serial,
          purchasePrice: a.price,
          status: a.status,
          assignedToEmployeeId: a.assignTo ?? null,
          assignedAt: a.assignTo ? new Date() : null,
        },
      });
    }
    console.log(`  ✓ ${assets.length} assets`);
  }

  // 16) Recruitment sample (one open job + a small candidate pipeline)
  const jobCount = await prisma.jobPosting.count({ where: { companyId: COMPANY_ID } });
  if (jobCount === 0) {
    const job = await prisma.jobPosting.create({
      data: {
        companyId: COMPANY_ID,
        title: "พนักงานขาย (Sales Executive)",
        departmentId: deptByCode.get("SALES"),
        employmentType: "FULL_TIME",
        openings: 2,
        location: "สำนักงานใหญ่ กรุงเทพ",
        status: "OPEN",
        description: "รับผิดชอบงานขายและดูแลความสัมพันธ์กับลูกค้า",
      },
    });
    const cands: {
      name: string;
      email: string;
      phone: string;
      stage: "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
    }[] = [
      { name: "กิตติ ศรีทอง", email: "kitti@example.com", phone: "0810000001", stage: "INTERVIEW" },
      { name: "มานี รักงาน", email: "manee@example.com", phone: "0810000002", stage: "SCREENING" },
      { name: "ปิติ ใจกล้า", email: "piti@example.com", phone: "0810000003", stage: "APPLIED" },
    ];
    for (const c of cands) {
      await prisma.candidate.create({
        data: {
          companyId: COMPANY_ID,
          jobPostingId: job.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          stage: c.stage,
        },
      });
    }
    console.log(`  ✓ 1 job posting + ${cands.length} candidates`);
  }

  // 16) Sample in-app notifications for the HR user (so the bell has content)
  const notifCount = await prisma.notification.count({ where: { companyId: COMPANY_ID } });
  if (notifCount === 0 && hrEmp) {
    const notifs = [
      {
        title: "คำขอลาใหม่รออนุมัติ",
        body: "มีคำขอลา 2 รายการรอการพิจารณาจากคุณ",
        category: "leave",
        read: false,
      },
      {
        title: "สลิปเงินเดือนพร้อมแล้ว",
        body: `สลิปเงินเดือนงวด ${payPeriod} ได้ออกให้พนักงานเรียบร้อยแล้ว`,
        category: "payroll",
        read: false,
      },
      {
        title: "ยินดีต้อนรับสู่ NEXA",
        body: "ระบบ HR & Payroll พร้อมใช้งาน ลองถาม NEXA AI เพื่อช่วยสรุปข้อมูลได้เลย",
        category: "system",
        read: true,
      },
    ];
    for (const n of notifs) {
      await prisma.notification.create({
        data: { companyId: COMPANY_ID, employeeId: hrEmp.id, ...n },
      });
    }
    console.log(`  ✓ ${notifs.length} notifications`);
  }

  // 17) Sample KPI / goals
  const goalCount = await prisma.goal.count({ where: { companyId: COMPANY_ID } });
  if (goalCount === 0 && allEmps.length > 0) {
    const cycle = `H1/${new Date().getFullYear() + 543}`;
    const sample = [
      { title: "ปิดการขายตามเป้าไตรมาส", type: "KPI" as const, unit: "ดีล", target: 20, current: 12, weight: 5 },
      { title: "คะแนนความพึงพอใจลูกค้า", type: "KPI" as const, unit: "%", target: 90, current: 88, weight: 4 },
      { title: "อบรมหลักสูตรพัฒนาทักษะ", type: "OKR" as const, unit: "หลักสูตร", target: 3, current: 1, weight: 2 },
    ];
    let made = 0;
    for (let i = 0; i < sample.length; i++) {
      const emp = allEmps[i % allEmps.length];
      const s = sample[i];
      const status =
        s.current >= s.target ? "COMPLETED" : s.current > 0 ? "IN_PROGRESS" : "NOT_STARTED";
      await prisma.goal.create({
        data: {
          companyId: COMPANY_ID,
          employeeId: emp.id,
          ownerEmployeeId: mgr?.id ?? null,
          title: s.title,
          type: s.type,
          cycle,
          unit: s.unit,
          targetValue: s.target,
          currentValue: s.current,
          weight: s.weight,
          status,
        },
      });
      made++;
    }
    console.log(`  ✓ ${made} goals`);
  }

  // 18) Sample training courses + a couple of enrollments
  const courseCount = await prisma.trainingCourse.count({ where: { companyId: COMPANY_ID } });
  if (courseCount === 0) {
    const courseData = [
      { title: "การสื่อสารอย่างมีประสิทธิภาพในองค์กร", category: "Soft Skills", hours: 6, provider: "ฝ่ายบุคคล", capacity: 30 },
      { title: "ความปลอดภัยของข้อมูลและ PDPA", category: "Compliance", hours: 3, provider: "ที่ปรึกษาภายนอก", capacity: 50 },
      { title: "พื้นฐานการเป็นหัวหน้างาน", category: "Leadership", hours: 12, provider: "สถาบันพัฒนาผู้นำ", capacity: 20 },
    ];
    const created: string[] = [];
    for (const c of courseData) {
      const course = await prisma.trainingCourse.create({
        data: {
          companyId: COMPANY_ID,
          title: c.title,
          category: c.category,
          hours: c.hours,
          provider: c.provider,
          capacity: c.capacity,
          status: "OPEN",
        },
        select: { id: true },
      });
      created.push(course.id);
    }
    // Enroll the first two employees in the first course
    if (created[0] && allEmps.length > 0) {
      for (const emp of allEmps.slice(0, 2)) {
        await prisma.trainingEnrollment.create({
          data: { companyId: COMPANY_ID, courseId: created[0], employeeId: emp.id, status: "ENROLLED" },
        });
      }
    }
    console.log(`  ✓ ${created.length} training courses`);
  }

  // 19) Sample expense claims
  const expenseCount = await prisma.expenseClaim.count({ where: { companyId: COMPANY_ID } });
  if (expenseCount === 0 && allEmps.length > 0) {
    const samples = [
      { title: "ค่าแท็กซี่ไปพบลูกค้า", category: "travel", amount: 350, status: "PENDING" as const },
      { title: "ค่าอาหารประชุมทีม", category: "food", amount: 1200, status: "APPROVED" as const },
      { title: "ค่าอุปกรณ์สำนักงาน", category: "supplies", amount: 780, status: "PAID" as const },
    ];
    let made = 0;
    for (let i = 0; i < samples.length; i++) {
      const emp = allEmps[i % allEmps.length];
      const s = samples[i];
      await prisma.expenseClaim.create({
        data: {
          companyId: COMPANY_ID,
          employeeId: emp.id,
          title: s.title,
          category: s.category,
          amount: s.amount,
          expenseDate: new Date(),
          status: s.status,
          decidedAt: s.status === "PENDING" ? null : new Date(),
          paidAt: s.status === "PAID" ? new Date() : null,
        },
      });
      made++;
    }
    console.log(`  ✓ ${made} expense claims`);
  }

  console.log("✅ Seed complete. Login with any of:");
  people.forEach((p) => console.log(`   ${p.email}  /  Password123!  (${p.role})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
