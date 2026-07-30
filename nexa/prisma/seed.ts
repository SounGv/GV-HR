import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_PRESETS, expandPermissions } from "../src/config/permissions";

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
