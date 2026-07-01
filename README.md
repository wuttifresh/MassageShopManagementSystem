# Massage Shop Management System

ระบบบริหารร้านนวดครบวงจร — ระบบจองคิว (ลูกค้า) + ระบบหลังบ้าน (เจ้าของ/พนักงาน/หมอนวด)

กำลังพัฒนาเป็น Phase ตามลำดับ สถานะปัจจุบัน: **Phase 9 — แจ้งเตือน & Polish** เสร็จแล้ว (ครบทุก Phase)

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

## POS & ชำระเงิน (Phase 6)

- `/dashboard/pos` — คิวที่เสร็จแล้ว (`DONE`) แต่ยังไม่ชำระเงิน + รายการล่าสุด (พร้อมยกเลิกใบเสร็จ)
- `/dashboard/pos/new?queueId=X` — หน้ารับชำระเงิน pre-fill จากคิว เพิ่มรายการอื่นได้, เลือกวิธี
  ชำระ (เงินสด/โอน/พร้อมเพย์/บัตร), ใส่ส่วนลด, คำนวณยอดสุทธิ + VAT breakdown แบบ real-time
- `/dashboard/pos/receipt/[id]` — ใบเสร็จ พิมพ์ได้ (`window.print()`)
- `src/lib/commission.ts` — คำนวณค่ามือหมอนวดจาก rate ปัจจุบัน (รวม per-service override) แล้ว
  snapshot ลง `TransactionItem` ทันที (hard rule #4) **ราคาขายคำนวณที่ server เท่านั้น ไม่เชื่อ
  ตัวเลขจาก client** ป้องกันการปลอมแปลงราคา ดูรายละเอียด VAT/การกันจ่ายซ้ำ/การยกเลิกใบเสร็จใน
  `prisma/ER.md` หัวข้อ "Phase 6 — POS & ชำระเงิน"

## สมาชิก / คอร์ส / CRM (Phase 7)

- `/dashboard/customers` — ค้นหาลูกค้าด้วยชื่อ/เบอร์โทร →
  `/dashboard/customers/[id]` ประวัติลูกค้าครบ: สมาชิก (tier/แต้ม), คอร์สคงเหลือ, ประวัติการจอง,
  ประวัติการชำระเงิน + `.../packages/new` ขายคอร์สใหม่ให้ลูกค้า
- `/account` (ฝั่งลูกค้า) เพิ่มส่วน "คอร์สของฉัน" แสดงจำนวนครั้งที่เหลือ
- `src/lib/loyalty.ts` — แต้มสะสม 1 แต้ม/25 บาทที่จ่ายจริง (ปัดลง), คืนแต้มอัตโนมัติเมื่อยกเลิกใบเสร็จ
- ตัดคอร์สแบบ atomic ผ่านการ redeem ที่หน้า POS โดยตรง (เลือก "ใช้คอร์ส" แทนการจ่ายเงินสดต่อรายการ)
  ทดสอบแล้วด้วย concurrent request จริงว่ากันการตัดครั้งซ้ำได้ (hard rule #5) ดูรายละเอียดทั้งหมด
  รวมถึง bug คอขวดเรื่องเลขที่ใบเสร็จที่เจอและแก้ระหว่างทดสอบใน `prisma/ER.md` หัวข้อ
  "Phase 7 — สมาชิก / คอร์ส / CRM"

## รายงาน & Multi-branch (Phase 8)

- `/dashboard/reports` — สรุปยอดขาย (OWNER/STAFF) เลือกช่วงวันที่ + สาขา (OWNER เลือกได้ทุกสาขา,
  STAFF ล็อกสาขาตัวเอง) แสดงยอดขายรวม/VAT/ค่ามือรวม + ตารางแยกตามบริการ/หมอนวด/รายวัน
  ปุ่ม "ส่งออก Excel" → `/api/reports/export` (`src/lib/reports.ts` คำนวณ aggregate, ใช้ไลบรารี
  `xlsx` สร้างไฟล์ 4 ชีต)
- `/dashboard/branches` — จัดการสาขา (OWNER เท่านั้น): สร้าง/แก้ไข ชื่อ/slug/ที่อยู่/เบอร์/เวลาเปิด-ปิด/
  สถานะเปิดใช้งาน (soft — ไม่มีการลบจริง)
- `/dashboard/staff` — จัดการบัญชีพนักงาน (OWNER เท่านั้น): สร้างบัญชี STAFF ใหม่ (อีเมล/รหัสผ่าน/สาขา)
  แก้ไขการมอบหมายสาขา/สถานะใช้งานภายหลัง — ทุก action เขียน `AuditLog`
- **Bug ที่เจอและแก้ระหว่างทดสอบ**: หน้า OWNER-only เดิม redirect ผู้ใช้ที่ login แล้วแต่ role ผิดไปที่
  `/login?callbackUrl=<หน้าเดิม>` ซึ่งทำให้เกิด infinite redirect loop (เพราะ `/login` ของ session ที่ login
  อยู่แล้วจะ redirect กลับไปตาม `callbackUrl` ทันที) แก้โดยไม่ยอมให้ session ที่ login อยู่แล้ว redirect ตาม
  `callbackUrl` อีกต่อไป (`/login` จะไปหน้า home ตาม role เสมอ), เพิ่ม `ROLE_HOME` ใน `middleware.ts` ให้ role
  ผิดแต่ login แล้วไปหน้า home ของตัวเองตรงๆ ไม่ผ่าน `/login`, และรวม logic ตรวจ OWNER ที่หน้า page-level ไว้ที่
  `src/lib/require-owner-page.ts` ดูรายละเอียดเต็มใน `prisma/ER.md` หัวข้อ "Phase 8 — รายงาน & Multi-branch"

## แจ้งเตือน & Polish (Phase 9)

- **LINE notifications** ผ่าน LINE Messaging API push message (`src/lib/line-messaging.ts`) —
  LINE Notify ถูกปิดให้บริการไปแล้วตั้งแต่มีนาคม 2025 จึงต้องใช้ Messaging API แทน ต้องสร้าง channel
  แยกจาก LINE Login (คนละ token) ดู `.env.example`/`DEPLOYMENT.md` ไม่ตั้งค่าไว้จะแค่ log ขึ้น console
  แทนการส่งจริง (ไม่ทำให้ flow การจอง/เช็คเอาท์พังถ้า LINE ล่ม)
  - ยืนยันจองสำเร็จ — ส่งทันทีใน `createBooking` (`src/app/book/actions.ts`) ถ้าลูกค้ามี `lineUserId`
  - เตือนก่อนถึงคิว — cron `/api/cron/reminders` เช็คการจองที่ยืนยันแล้วซึ่งจะถึงเวลาภายใน 30 นาที
    ยังไม่เคยเตือน (`Booking.reminderSentAt`) แล้วส่ง + mark ว่าส่งแล้วกันส่งซ้ำ
  - สรุปยอดสิ้นวันให้เจ้าของ — cron `/api/cron/daily-summary` ส่งสรุปยอดขายวันนี้ (รวม + แยกตามสาขา)
    ให้ทุก user role OWNER ที่มี `lineUserId`
- **Cron**: `vercel.json` ตั้ง daily-summary ให้รันวันละครั้ง (Vercel Hobby รองรับแค่นี้) ส่วน
  reminders ต้องรันถี่กว่านั้นมาก จึงใช้ `.github/workflows/reminders.yml` (GitHub Actions ฟรี รันทุก
  10 นาที) แทน ทั้งสอง endpoint เช็ค `Authorization: Bearer $CRON_SECRET` (`src/lib/cron-auth.ts`)
  ก่อนทำงานเสมอ
  - **เจอบั๊กระหว่างทดสอบ**: ทั้งสอง route ถูก Next.js มองว่าเป็น static route (ไม่มี dynamic API
    เรียกใช้ตรงๆ) แล้ว prerender ไว้ตอน build เพียงครั้งเดียว — ถ้าไม่แก้ cron จะได้ response เดิมซ้ำ
    ทุกครั้งไม่ว่าจะเรียกกี่โมง ไม่สะท้อนเวลา/ข้อมูลจริงเลย เห็นได้จาก `npm run build` ที่ list ทั้งคู่
    เป็น `○ (Static)` แก้ด้วย `export const dynamic = "force-dynamic"` ในทั้งสอง route (ตรวจซ้ำแล้วว่า
    build ออกมาเป็น `ƒ (Dynamic)` ถูกต้อง)
- **Error/loading/responsive polish**: เพิ่ม `src/app/error.tsx`/`not-found.tsx` (Thai copy) +
  `loading.tsx` skeleton ที่ `/dashboard`, `/book`, `/account`, `/therapist` ทดสอบ responsive จริง
  ด้วย Playwright ที่ mobile viewport (375px) — **เจอ bug จริง**: nav links บนหน้า `/dashboard` ใช้
  `flex` ไม่มี `flex-wrap` พอมีลิงก์ 7 อัน (เพิ่มมาจาก Phase 8) ล้นจอ mobile แก้แล้ว
- **`DEPLOYMENT.md`** — คู่มือ deploy Vercel + Supabase ครบ (LINE channel setup, cron setup,
  production checklist)
- **`supabase/deploy.sql`** — รวม migration ทั้งหมดเป็นไฟล์เดียว วางใน Supabase SQL Editor รันได้เลย
  โดยไม่ต้องมี Node/Prisma CLI (generate จาก `npm run db:build-sql` → `scripts/build-supabase-sql.mjs`
  ต้องรันคำสั่งนี้ใหม่ทุกครั้งที่เพิ่ม migration ใหม่ ไฟล์นี้ไม่ auto-sync)

## Hard rules (บังคับทุก Phase)

ดูรายละเอียดเต็มในคอมเมนต์บนสุดของ `prisma/schema.prisma` — สรุปสั้นๆ:

1. ห้ามใช้ float กับเงิน (ใช้ `Decimal @db.Decimal(10,2)`)
2. ห้าม hard delete ข้อมูลการเงิน/การจอง (soft delete ด้วย `deletedAt`)
3. บังคับ audit log ทุก transaction การเงิน/การแก้คิว (`AuditLog`)
4. ค่ามือหมอนวด snapshot ตอนขาย ไม่อ้างอิง rate ปัจจุบัน (`TransactionItem.commissionRate`)
5. ตัดคอร์ส/แพ็กเกจต้อง atomic (`Package.remainingSessions` + `PackageUsage` ในทรานแซกชันเดียว)
6. กัน double-booking ด้วย PostgreSQL `EXCLUDE` constraint ระดับ DB (ไม่ใช่แค่ app logic)
