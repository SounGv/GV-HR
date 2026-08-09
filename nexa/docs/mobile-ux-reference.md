# Mobile UX Reference — for PHASE 14 (Mobile App UX)

Reference mockups collected ahead of Phase 14. Not implemented yet — Phase 14
comes after Attendance (4), Leave/OT/WFH (5), and Payroll (6/7) per the
Master Prompt phase order. Do not build from this until "เริ่ม PHASE 14" is
given.

## Mobile Home (received 2026-08-08)

```
GV One

สวัสดี สมชาย 👋
EMP0001 • ฝ่ายขาย

┌─────────────────────────┐
│ วันนี้ 8 ส.ค. 2569      │
│                         │
│ 🟢 เข้างานแล้ว          │
│ 08:02 น.                │
│ สำนักงานใหญ่            │
│                         │
│      [ ออกงาน ]         │
└─────────────────────────┘

วันนี้
เวลา  08:02
OT    0:00
คำขอ  1 รายการ

เมนู
[ ลางาน ] [ ขอ OT ]
[ WFH ]   [ งานนอกสถานที่ ]

Bottom
⌂ หน้าหลัก | ◷ เวลา | □ คำขอ | ฿ สลิป | ♙ โปรไฟล์
```

Notes for later:
- Depends on real Attendance (check-in status/time/location) and OT data —
  needs Phase 4/5 backend to exist first.
- Bottom nav here (หน้าหลัก / เวลา / คำขอ / สลิป / โปรไฟล์) differs from the
  current 5-slot nav in `mobile-bottom-nav.tsx` (หน้าหลัก / บริการ / [เช็คอิน
  FAB] / AI-or-แจ้งเตือน / โปรไฟล์) — reconcile during Phase 14, don't
  silently diverge.
