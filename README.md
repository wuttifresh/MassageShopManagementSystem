# Massage Shop Management System

ระบบบริหารร้านนวดครบวงจร — ระบบจองคิว (ลูกค้า) + ระบบหลังบ้าน (เจ้าของ/พนักงาน/หมอนวด)

กำลังพัฒนาเป็น Phase ตามลำดับ สถานะปัจจุบัน: **Phase 1 — Foundation & Schema** เสร็จแล้ว

## Tech Stack

- Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS
- PostgreSQL (Supabase) + Prisma ORM 7 (query compiler + `@prisma/adapter-pg` driver adapter)
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

## Hard rules (บังคับทุก Phase)

ดูรายละเอียดเต็มในคอมเมนต์บนสุดของ `prisma/schema.prisma` — สรุปสั้นๆ:

1. ห้ามใช้ float กับเงิน (ใช้ `Decimal @db.Decimal(10,2)`)
2. ห้าม hard delete ข้อมูลการเงิน/การจอง (soft delete ด้วย `deletedAt`)
3. บังคับ audit log ทุก transaction การเงิน/การแก้คิว (`AuditLog`)
4. ค่ามือหมอนวด snapshot ตอนขาย ไม่อ้างอิง rate ปัจจุบัน (`TransactionItem.commissionRate`)
5. ตัดคอร์ส/แพ็กเกจต้อง atomic (`Package.remainingSessions` + `PackageUsage` ในทรานแซกชันเดียว)
6. กัน double-booking ด้วย PostgreSQL `EXCLUDE` constraint ระดับ DB (ไม่ใช่แค่ app logic)
