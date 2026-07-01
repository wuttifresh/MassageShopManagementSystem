# Massage Shop Management System

ระบบบริหารร้านนวดครบวงจร — ระบบจองคิว (ลูกค้า) + ระบบหลังบ้าน (เจ้าของ/พนักงาน/หมอนวด)

กำลังพัฒนาเป็น Phase ตามลำดับ สถานะปัจจุบัน: **Phase 5 — จัดการหมอนวด & บริการ** เสร็จแล้ว

## Tech Stack

- Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS
- PostgreSQL (Supabase) + Prisma ORM 7 (query compiler + `@prisma/adapter-pg` driver adapter)
- NextAuth v4 (JWT session) — email+password (OWNER/STAFF/THERAPIST) + LINE Login (CUSTOMER)
- Font: Sarabun / Noto Sans Thai, UI ภาษาไทย, mobile-first

## เริ่มต้นใช้งาน (Local development)

ต้องมี PostgreSQL รันอยู่ (local หรือ Supabase ก็ได้)

```bash
npm install
cp .env.example .env   # แล้วแก้ DATABASE_URL / DIRECT_URL ให้ชี้ไปยัง Postgres จริง

npx prisma migrate dev   # สร้างตาราง + apply migration (รวม constraint กัน double-booking)
npm run db:seed          # ใส่ seed data ตัวอย่าง (สาขา/บริการ/หมอนวด/ลูกค้าตัวอย่าง)

npm run dev               # เปิด http://localhost:3000
```

คำสั่งอื่นที่ใช้บ่อย:

```bash
npm run db:studio   # เปิด Prisma Studio ดู/แก้ข้อมูลผ่าน UI
npm run db:migrate  # เหมือน prisma migrate dev
npm run build        # production build
```

## โครงสร้างที่เกี่ยวกับฐานข้อมูล

- `prisma/schema.prisma` — schema หลัก ครบทุกโมเดลของ Phase 1
- `prisma/ER.md` — **ER diagram + คำอธิบาย data flow + ข้อสมมติฐานที่ตัดสินใจแทน** อ่านก่อนต่อ Phase ถัดไป
- `prisma/migrations/` — migration ที่ apply แล้ว (รวม raw SQL กัน double-booking ที่ระดับ DB)
- `prisma/seed.ts` — seed data ตัวอย่าง
- `src/lib/prisma.ts` — Prisma Client singleton (ใช้ driver adapter, ต้อง import จากตรงนี้เท่านั้น)

## Auth (Phase 2)

- `src/lib/auth.ts` — NextAuth config (credentials + LINE), `src/middleware.ts` — role-based route
  protection, `src/lib/session.ts` — server-side session helper ดูรายละเอียดสถาปัตยกรรมใน
  `prisma/ER.md` หัวข้อ "Phase 2 — Auth & Roles"
- Route ตัวอย่างที่ถูกป้องกันด้วย role: `/dashboard` (OWNER/STAFF), `/therapist` (THERAPIST),
  `/account` (CUSTOMER) — เข้าผิด role หรือยังไม่ login จะถูก redirect ไป `/login`
- Demo login (จาก `npm run db:seed`, ห้ามใช้ค่านี้ใน production):
  `owner@massageshop.test` / `staff@massageshop.test` / `nok@massageshop.test` — รหัสผ่าน
  `Password123!` ทดสอบ LINE Login ต้องสร้าง LINE Login channel เองแล้วใส่
  `LINE_CLIENT_ID`/`LINE_CLIENT_SECRET` ใน `.env`

## ระบบจองคิว (Phase 3)

- `/book` — ฟอร์มจอง mobile-first (CUSTOMER เท่านั้น): สาขา → บริการ → ระยะเวลา → หมอนวด
  (หรือ "คนไหนก็ได้") → วัน-เวลา → ยืนยัน
- `/account` — รายการการจองของฉัน พร้อมยกเลิก/เลื่อนนัด (`/account/bookings/[id]/reschedule`)
- `src/lib/availability.ts` — แกนคำนวณ slot ว่างทั้งหมด, `src/app/book/actions.ts` /
  `src/app/account/actions.ts` — server actions สร้าง/ยกเลิก/เลื่อนการจอง
- กัน double-booking สองชั้น: เช็ค availability ในแอปก่อน (UX) + PostgreSQL `EXCLUDE` constraint
  เป็นด่านสุดท้ายที่ระดับ DB (ทดสอบจริงด้วย concurrent request แล้ว) ดูรายละเอียดใน `prisma/ER.md`
  หัวข้อ "Phase 3 — ระบบจองคิว (Customer)"

## ระบบจัดการคิว - Admin (Phase 4)

- `/dashboard` — เช็คอินจากการจอง, เพิ่มคิว walk-in, มอบหมายหมอนวด, เปลี่ยนสถานะคิว
  (รอ → มอบหมายแล้ว → กำลังนวด → เสร็จ), ระบุเตียง, ยกเลิกคิว (OWNER เห็นทุกสาขา, STAFF เฉพาะสาขาตัวเอง)
- `src/lib/queue.ts` / `src/app/dashboard/actions.ts` — logic คิวรายวันและ server actions ทั้งหมด
  (ทุก action เขียน `AuditLog`)
- `src/app/dashboard/queue-realtime-listener.tsx` — Supabase Realtime (no-op ถ้าไม่ได้ตั้งค่า
  `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`) ต้องรัน `alter publication supabase_realtime add table queues;`
  บน Supabase project จริงด้วย ดูรายละเอียดใน `prisma/ER.md` หัวข้อ "Phase 4 — ระบบจัดการคิว (Admin)"

## จัดการหมอนวด & บริการ (Phase 5)

- `/dashboard/therapists` — list/สร้าง/แก้ไขหมอนวด (ชื่อเล่น, ค่ามือ, ความถนัด, สถานะ), ลิงก์ไป
  `/dashboard/therapists/[id]/schedule` จัดการตารางเวร 14 วันข้างหน้า (ทำงาน/วันหยุด/ลา)
- `/dashboard/services` — list/สร้าง/แก้ไขบริการ + ตัวเลือกระยะเวลา/ราคา/ราคาโปรโมชั่น
  (`ServiceOption.promoPrice`)
- ไม่มีปุ่ม "ลบ" จริง — "ลบ" หมอนวด/บริการทำผ่านการปิดใช้งาน (`status`/`isActive`) เท่านั้น
  ดูเหตุผลและรายละเอียดเพิ่มเติมใน `prisma/ER.md` หัวข้อ "Phase 5 — จัดการหมอนวด & บริการ"

## Hard rules (บังคับทุก Phase)

ดูรายละเอียดเต็มในคอมเมนต์บนสุดของ `prisma/schema.prisma` — สรุปสั้นๆ:

1. ห้ามใช้ float กับเงิน (ใช้ `Decimal @db.Decimal(10,2)`)
2. ห้าม hard delete ข้อมูลการเงิน/การจอง (soft delete ด้วย `deletedAt`)
3. บังคับ audit log ทุก transaction การเงิน/การแก้คิว (`AuditLog`)
4. ค่ามือหมอนวด snapshot ตอนขาย ไม่อ้างอิง rate ปัจจุบัน (`TransactionItem.commissionRate`)
5. ตัดคอร์ส/แพ็กเกจต้อง atomic (`Package.remainingSessions` + `PackageUsage` ในทรานแซกชันเดียว)
6. กัน double-booking ด้วย PostgreSQL `EXCLUDE` constraint ระดับ DB (ไม่ใช่แค่ app logic)
