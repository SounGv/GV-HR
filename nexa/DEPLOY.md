# คู่มือ Deploy NEXA — Vercel + Supabase + GitHub

แอปนี้เป็น **Next.js 15 + Prisma + PostgreSQL** ขึ้น **Vercel** ได้โดยไม่ต้องแก้โค้ด
ใช้ **Supabase** เป็นฐานข้อมูล และ **GitHub** เป็นตัวกลาง (push แล้ว deploy อัตโนมัติ)

> repo อยู่ที่ `SounGv/GV-HR` แล้ว โค้ดแอปอยู่ในโฟลเดอร์ย่อย **`nexa/`** — จำจุดนี้ไว้ ตอนตั้ง Vercel ต้องระบุ Root Directory = `nexa`

---

## ขั้นที่ 1 — รวมโค้ดเข้า main
บน GitHub: เปิด Pull Request #1 (branch `feat/nexa-platform-foundation`) แล้วกด **Merge** เข้า `main`
(หรือจะให้ Vercel deploy จาก branch นี้ตรง ๆ ก็ได้)

---

## ขั้นที่ 2 — สร้างฐานข้อมูล Supabase
1. ไปที่ https://supabase.com → **New project** → ตั้งชื่อ + ตั้ง **Database Password** (จำไว้)
2. รอ ~2 นาทีให้ DB พร้อม
3. ไปที่ **Project Settings → Database → Connection string** จะเห็น 2 แบบ — เก็บทั้งคู่:

| ใช้เป็น | Supabase เรียกว่า | พอร์ต |
|---|---|---|
| `DATABASE_URL` (แอปตอนรัน) | **Transaction Pooler** | 6543 |
| `DIRECT_URL` (ตอน migrate) | **Direct connection** | 5432 |

- `DATABASE_URL` ให้เติมท้าย: `?pgbouncer=true&connection_limit=1`
- แทน `[YOUR-PASSWORD]` ในสตริงด้วยรหัสที่ตั้งไว้

ตัวอย่าง:
```
DATABASE_URL=postgresql://postgres.abcd:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.abcd:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

---

## ขั้นที่ 3 — Import โปรเจกต์เข้า Vercel
1. https://vercel.com → **Add New → Project** → เลือก repo `SounGv/GV-HR`
2. **Root Directory** → กด Edit → เลือก **`nexa`** ⬅️ สำคัญมาก
3. Framework Preset จะขึ้น **Next.js** อัตโนมัติ (Build Command ใช้ `vercel-build` ในโปรเจกต์ = รัน `prisma migrate deploy` ให้เอง — ไม่ต้องตั้งเพิ่ม)
4. ใส่ **Environment Variables** (ตั้งให้ครบก่อนกด Deploy):

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | (Transaction Pooler จากขั้น 2) |
| `DIRECT_URL` | (Direct connection จากขั้น 2) |
| `JWT_ACCESS_SECRET` | สุ่มยาว ๆ เช่นจาก `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | สุ่มอีกค่า (คนละอันกับด้านบน) |
| `ACCESS_TOKEN_TTL` | `900` |
| `REFRESH_TOKEN_TTL` | `1209600` |
| `APP_URL` | URL ที่ Vercel จะให้ (เช่น `https://nexa-xxx.vercel.app`) ใส่ทีหลังได้ |
| `ANTHROPIC_API_KEY` | (ไม่บังคับ) ใส่ถ้าจะเปิด NEXA AI |

> `NODE_ENV=production` Vercel ตั้งให้อัตโนมัติ ไม่ต้องใส่

5. กด **Deploy** — ตอน build ระบบจะรัน `prisma migrate deploy` สร้างตารางทั้งหมดใน Supabase ให้เอง

---

## ขั้นที่ 4 — ใส่ข้อมูลเริ่มต้น (seed) ครั้งเดียว
ตาราง migrate ให้แล้ว แต่ยังว่าง ต้อง seed ข้อมูลตั้งต้น (บริษัท, roles, 8 ฝ่าย, บัญชีทดลอง) — ทำครั้งเดียวจากเครื่องตัวเอง:

1. ก๊อปโฟลเดอร์ `nexa` ไปไว้ path สั้น ๆ ไม่มี `&` เช่น `C:\nexa` (กันปัญหาชื่อโฟลเดอร์มี `&`)
2. ในโฟลเดอร์นั้น สร้างไฟล์ `.env` ใส่ `DATABASE_URL` + `DIRECT_URL` ให้ชี้ไป Supabase (ค่าเดียวกับขั้น 2)
3. รัน:
```bash
npm install
npm run db:seed
```
4. ขึ้น `✅ Seed complete` = เสร็จ — ข้อมูลเข้าสู่ Supabase แล้ว

> เปิด Supabase → Table Editor เช็คได้ว่ามีตาราง `companies`, `departments`, `users` ฯลฯ พร้อมข้อมูล

---

## ขั้นที่ 5 — เข้าใช้งาน
เปิด URL จาก Vercel แล้วล็อกอินด้วยบัญชีทดลอง (รหัสผ่านทุกบัญชี = `Password123!`):

| อีเมล | บทบาท |
|---|---|
| `admin@nexa.co.th` | Super Admin (เห็นทุกอย่าง) |
| `hr@nexa.co.th` | HR Manager |
| `manager@nexa.co.th` | หัวหน้าทีม |
| `employee@nexa.co.th` | พนักงาน |
| `finance@nexa.co.th` | การเงิน |

> ⚠️ ขึ้น production จริงแล้ว **เปลี่ยนรหัสผ่าน/ลบบัญชีทดลอง** และตั้ง JWT secret ให้เป็นค่าจริง

---

## หลังจากนี้ — อัปเดตอัตโนมัติ
แก้โค้ด → `git push` เข้า branch ที่ Vercel ดูอยู่ → **Vercel build + deploy ให้เองทุกครั้ง**
ถ้าแก้ schema ฐานข้อมูล: สร้าง migration (`npm run db:migrate` ที่เครื่อง) แล้ว commit โฟลเดอร์ `prisma/migrations/` — ตอน deploy ระบบจะ `migrate deploy` ให้เอง

---

## แก้ปัญหาที่พบบ่อย
- **Build fail ตอน migrate**: เช็คว่า `DIRECT_URL` (พอร์ต 5432) ถูกต้อง — migrate ต้องใช้ direct ไม่ใช่ pooler
- **แอปต่อ DB ไม่ได้ตอนรัน**: เช็คว่า `DATABASE_URL` เป็น pooler (6543) + มี `?pgbouncer=true&connection_limit=1`
- **ล็อกอินไม่ได้ / error auth**: เช็คว่าใส่ `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` แล้ว (production จะไม่ยอมรันถ้าไม่ตั้ง)
- **NEXA AI ใช้ไม่ได้**: ต้องใส่ `ANTHROPIC_API_KEY` (ถ้าไม่ใส่ ฟีเจอร์อื่นยังทำงานปกติ)
