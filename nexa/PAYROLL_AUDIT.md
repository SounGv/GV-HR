# GV ONE HR — Payroll Calculation Engine: Audit Report

วันที่ตรวจสอบ: 2026-08-12
ขอบเขต: ตรวจสอบ source code จริงของระบบ Payroll และระบบที่เกี่ยวข้อง (Attendance/Leave/OT ในมุมที่กระทบการคำนวณเงินเดือน) ก่อนอัปเกรดให้ใช้งานจริงในองค์กร ตามหลักการ "อ่านโค้ดจริงก่อน ห้ามเดา แก้เฉพาะ MISSING/PARTIAL/BROKEN ห้ามเขียนของเดิมที่ใช้งานได้ถูกต้องอยู่แล้วซ้ำ"

## 1. Database Schema — `prisma/schema.prisma`

| รายการ | สถานะ | หมายเหตุ |
|---|---|---|
| `PayrollRecord` model (earnings/deductions เป็น JSON line-item, gross/totalDeductions/net, status, paidAt) | **EXISTING** | `schema.prisma:1001-1041` ครบ unique `[employeeId, period]` |
| `PayrollStatus` enum | **PARTIAL** | มีแค่ `DRAFT`/`PAID` 2 สถานะ — ไม่มี concept "ปิดงวดทั้งบริษัท" |
| Model แยกสำหรับ Bonus/Commission/Allowance/Deduction/Tax/SocialSecurity/Loan/Advance | **ไม่จำเป็น (by design)** | ทุกอย่างเป็น JSON line-item ใน `earnings`/`deductions` — ใช้งานได้จริงผ่านฟอร์ม "ปรับปรุงรายการ" ของ HR แล้ว การแยก model จะเป็นการสร้างระบบซ้ำ ไม่ใช่ gap |
| Employee.baseSalary/bankName/bankAccountNo/bankBranch | **EXISTING** | `schema.prisma:708-713` |
| Payroll period lock (ปิดงวด กันแก้ไข/generate ซ้ำหลังปิดบัญชี) | **MISSING** | ยืนยันจาก audit ✅ **แก้ไขในรอบนี้** — เพิ่ม model `PayrollPeriod` ใหม่ (additive, ไม่แก้ตารางเดิม) |

## 2. Payroll Calculation Logic — `src/features/payroll/calc.ts`

| รายการ | สถานะ | หมายเหตุ |
|---|---|---|
| เงินเดือนฐาน, allowance, OT, bonus, other earnings (สูตรคำนวณ) | **EXISTING** | ฟังก์ชัน `computePayroll()` รองรับครบ |
| ภาษีหัก ณ ที่จ่าย — ตารางขั้นบันได | **EXISTING** | ใช้ตาราง 8 ขั้นจริงของกรมสรรพากร (`calc.ts:31-40`) |
| ประกันสังคม 5% (floor 1,650 / cap 15,000 → 83–750 บาท) | **EXISTING แต่ต้องยืนยันอัตรา** | สูตรถูกต้องตามฐานเดิม — **ต้องให้ฝ่ายบัญชี/HR ยืนยันว่าเพดานล่าสุดยังเป็น 15,000 หรือปรับเป็นเพดานใหม่ตามประกาศ สปส. รอบล่าสุดหรือยัง** ผมไม่แก้อัตรานี้เองเพราะมีผลกับเงินที่พนักงานได้รับจริงและยอดนำส่งราชการ ⚠️ **ต้องให้คุณ/ฝ่ายบัญชียืนยันก่อน** |
| ลดหย่อนภาษี (เฉพาะค่าใช้จ่าย 50%+เพดาน 100k และลดหย่อนส่วนตัว 60k) | **PARTIAL (ยอมรับได้ในระดับพื้นฐาน)** | ไม่รองรับลดหย่อนคู่สมรส/บุตร/ประกันชีวิต/กยศ. ฯลฯ — เป็น scope ใหญ่ที่ควรทำเป็นโปรเจกต์ย่อยแยก ไม่ใช่แก้ตอนนี้เพราะต้อง design ฟอร์มกรอกลดหย่อนรายคนใหม่ทั้งหมด |
| Bonus/Commission/Loan/Advance/PF-rate เป็น parameter | **PARTIAL — ใช้งานได้จริงแต่ไม่ผ่าน parameter เฉพาะ** | `computePayroll` รับ parameter เหล่านี้ แต่ `service.ts` (ผู้เรียกจริง 2 จุด) ไม่เคยส่งเข้าไปเลย — HR ใช้ "extraEarnings/extraDeductions" (label พิมพ์เองได้) แทน ซึ่ง**ทำงานได้ผลลัพธ์เดียวกัน** จึงไม่ถือเป็น MISSING ที่ต้องรีบแก้ (การเพิ่ม field เฉพาะจะเป็นการสร้างกลไกซ้ำกับที่มีอยู่แล้ว) — ถ้าต้องการ "รายงานแยกยอดโบนัส/คอมมิชชั่นทั้งบริษัท" แบบไม่พึ่ง label string ตรงเป๊ะ ต้องคุยเรื่อง data model เพิ่มเติมเป็นงานถัดไป |
| **หักเงินเดือนตามวันลาไม่รับค่าจ้าง (Unpaid Leave)** | **MISSING** | ยืนยันจาก audit ✅ — เงินเดือนพื้นฐานจ่ายเต็มจำนวนเสมอ ไม่ลดตามวันลาไม่รับค่าจ้างที่อนุมัติแล้ว **แก้ไขในรอบนี้** |
| หักเงินเดือนตามวันขาดงาน (ไม่มีใบลา ไม่มีการอนุมัติ) | **MISSING แต่ไม่แก้ตอนนี้** | ต้องเป็น policy decision ขององค์กรว่าจะ auto-deduct จากสถานะ ABSENT ทันทีหรือต้องให้ HR รีวิวก่อน — ไม่ implement เอง เพราะเป็นการตัดสินใจเชิงนโยบายที่มีผลจ่ายเงินจริง |

## 3. Integration กับ Attendance/OT/Leave

| รายการ | สถานะ |
|---|---|
| ดึงค่าล่วงเวลา (OT) ที่อนุมัติแล้วมาบวกอัตโนมัติ | **EXISTING** (`service.ts:75-80`) |
| ดึงวันลาไม่รับค่าจ้างมาหักอัตโนมัติ | **MISSING → แก้ไขในรอบนี้** |
| ดึงวันขาดงาน (Attendance status ABSENT) มาหักอัตโนมัติ | **MISSING (ตั้งใจไม่แก้ — ต้องตัดสินใจนโยบายก่อน)** |

## 4. API Routes — `src/app/api/payroll/`

ทุก route มีอยู่แล้วและใช้งานได้ถูกต้อง (list, generate, get one, adjust, pay, send-email, import) พร้อม permission gate (`payroll:read/create/update/approve/export`) — **EXISTING ทั้งหมด**, ไม่มีจุดที่ broken

## 5. Payroll Period / Approval / Locking

| รายการ | สถานะ |
|---|---|
| สถานะ DRAFT → PAID ต่อรายการ | **EXISTING** |
| กันแก้ไข/generate ซ้ำรายการที่ PAID แล้ว | **EXISTING** (`service.ts:95,220`) |
| **ปิดงวดทั้งบริษัท (ล็อกไม่ให้ generate/แก้ไขรายการใดในงวดนั้นได้อีก แม้ยังเป็น DRAFT)** | **MISSING → แก้ไขในรอบนี้** |
| Multi-step approval (เช่น Finance ตรวจ → HR อนุมัติ → จ่ายจริง) | **MISSING — ไม่ implement เอง** | ต้องให้คุณกำหนด flow ที่ต้องการก่อน (ใครอนุมัติกี่ขั้น) — ไม่ใช่สิ่งที่เดาเองได้ |

## 6. Payslip Generation

| รายการ | สถานะ |
|---|---|
| หน้าดูสลิป + QR verify (public, ไม่โชว์ยอดเงิน) | **EXISTING** — ออกแบบมาปลอดภัยดีอยู่แล้ว |
| ส่งสลิปทางอีเมล (HTML) | **EXISTING** |
| Export เป็น PDF ฝั่ง server (batch) | **PARTIAL** — ปัจจุบันใช้ browser print-to-PDF (ใช้งานได้ แต่ไม่เหมาะกับการยิง batch จำนวนมาก) — **ไม่ implement เพิ่มตอนนี้** เพราะต้องเพิ่ม dependency ใหม่ (PDF renderer) ซึ่งมีผลกระทบต่อขนาด build/เวลา build; ถ้าต้องการจริงควรคุยขอบเขตก่อนแยกเป็นงานใหม่

## 7. Reports

| รายการ | สถานะ |
|---|---|
| สรุปเงินเดือนสุทธิรวมตามแผนก | **EXISTING** |
| **ยอดรวมภาษีหัก ณ ที่จ่าย + ประกันสังคมทั้งบริษัท (สำหรับนำส่งสรรพากร/สปส.)** | **MISSING → แก้ไขในรอบนี้** |
| แยกตาม Cost Center | **MISSING — ไม่ implement ตอนนี้** เป็น scope เพิ่มเติมนอกเหนือจากที่พบว่ากระทบการใช้งานจริงเร่งด่วน |

## 8. Permissions / Auth

ตรวจสอบแล้ว: ทุก endpoint มี `requirePermission()` ตรวจสิทธิ์ฝั่ง backend จริง (ไม่เชื่อ frontend permission อย่างเดียว) — payroll:read/create/update/approve/export ผูกกับ Role preset ถูกต้อง — **EXISTING ทั้งหมด**

---

## สรุป: สิ่งที่แก้ไขในรอบนี้ (MISSING ที่ปลอดภัยพอจะ implement ได้โดยไม่ต้องรอ policy decision)

1. ✅ หักเงินเดือนตามวันลาไม่รับค่าจ้าง (UNPAID leave) ที่อนุมัติแล้ว — ใช้ base rate เดิมที่ระบบ OT ใช้อยู่แล้ว (`baseSalary / 30` ต่อวัน) เพื่อความสม่ำเสมอ
2. ✅ ระบบปิดงวดเงินเดือน (Payroll Period Lock) — เพิ่ม model ใหม่ 1 ตัว (`PayrollPeriod`) กันไม่ให้ generate/แก้ไขงวดที่ปิดแล้วได้อีก ใช้สิทธิ์เดียวกับการ mark-paid (`payroll:approve`)
3. ✅ รายงานยอดรวมภาษี/ประกันสังคมทั้งบริษัทต่อยงวด (เพิ่มใน "สรุปเงินเดือน (รายงวด)" ที่มีอยู่แล้ว ไม่สร้างรายงานใหม่)

## สิ่งที่**ไม่แก้** ในรอบนี้ เพราะต้องให้คุณ/ฝ่ายบัญชียืนยันหรือกำหนด policy ก่อน

- **อัตรา/เพดานประกันสังคม** ปัจจุบันใช้ 5% cap 15,000 (=750 บาทสูงสุด) — ต้องยืนยันว่ายังใช้เพดานนี้อยู่หรือ สปส. ประกาศเพดานใหม่แล้ว
- **การหักเงินเดือนกรณีขาดงานแบบไม่มีใบลา** (Attendance status = ABSENT) — เป็น policy call ว่าจะ auto-deduct หรือให้ HR ตรวจก่อน
- **Multi-step approval workflow** (Finance → HR → จ่ายจริง) — ต้องรู้ว่าต้องการกี่ขั้น ใครอนุมัติ
- **ลดหย่อนภาษีแบบละเอียด** (คู่สมรส/บุตร/ประกันชีวิต/กยศ.) — scope ใหญ่ ต้อง design ฟอร์มข้อมูลลดหย่อนรายคนเพิ่ม
- **PDF export ฝั่ง server แบบ batch** — ของเดิม (browser print) ใช้งานได้อยู่ ยังไม่ถือว่า broken/missing ถึงขั้นต้องรีบเพิ่ม dependency ใหม่
