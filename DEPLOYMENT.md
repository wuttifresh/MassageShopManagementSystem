# คู่มือ Deploy (Vercel + Supabase)

เป้าหมายงบประมาณ ~$2-4 USD/เดือน: Vercel Hobby (ฟรี) + Supabase ระดับเริ่มต้น (Free tier หรือ
Pro ถ้าข้อมูลเกิน free tier limit) ระบบทั้งหมดถูกออกแบบให้รันบน serverless (Next.js API
Routes/Server Actions) ไม่มี background worker แยก ยกเว้น cron ที่ใช้ Vercel Cron
+ GitHub Actions (ทั้งคู่ฟรี)

## 1. เตรียม Supabase project

1. สร้างโปรเจกต์ใหม่ที่ https://supabase.com/dashboard
2. ไปที่ Project Settings → Database → Connection string เก็บไว้ 2 แบบ:
   - **Pooled connection** (port 6543, ผ่าน PgBouncer) → ใช้เป็น `DATABASE_URL` (runtime)
   - **Direct connection** (port 5432) → ใช้เป็น `DIRECT_URL` (สำหรับ `prisma migrate`)
3. ไปที่ Project Settings → API เก็บ `Project URL` และ `anon public key` ไว้เป็น
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, เก็บ `service_role key`
   ไว้เป็น `SUPABASE_SERVICE_ROLE_KEY` (ห้ามเปิดเผยฝั่ง client)
4. สร้างตารางทั้งหมด — เลือกวิธีใดวิธีหนึ่ง:

   **วิธี A (แนะนำ, ถ้ามีเครื่องที่ลง Node ได้)** รัน migration จริงจากเครื่อง local โดยชี้
   `DIRECT_URL`/`DATABASE_URL` ไปที่ Supabase:
   ```bash
   npx prisma migrate deploy
   npm run db:seed   # เฉพาะครั้งแรก ถ้าต้องการข้อมูลตัวอย่าง — อย่ารันซ้ำใน production ที่มีข้อมูลจริงแล้ว
   ```

   **วิธี B (ไฟล์เดียว, ไม่ต้องลง Node/Prisma CLI)** — เปิด `supabase/deploy.sql` (generate ไว้แล้ว
   จาก migration ทั้งหมดด้วย `scripts/build-supabase-sql.mjs`) copy ทั้งไฟล์ไปวางใน Supabase
   Dashboard → SQL Editor → New query แล้วกด Run ครั้งเดียว (ทดสอบแล้วว่ารันผ่านทั้งไฟล์ในทรานแซกชัน
   เดียวบน Postgres สะอาดๆ ได้จริง ไม่ error) ไฟล์นี้จะ insert bookkeeping ลงตาราง
   `_prisma_migrations` ให้ด้วย ดังนั้นถ้าภายหลังต้องรัน `npx prisma migrate deploy`/`dev` จากเครื่อง
   dev จริง Prisma จะเห็นว่า migration เหล่านี้ apply ไปแล้ว (checksum ตรงกัน) ไม่พยายามสร้างตารางซ้ำ
   จนพัง — **ถ้าเพิ่ม migration ใหม่ในอนาคตต้องรัน `npm run db:build-sql` ใหม่เพื่ออัปเดต
   `supabase/deploy.sql` ก่อน** (ไฟล์นี้ไม่ auto-sync)

   ไม่ว่าจะใช้วิธีไหน ถ้าต้องการข้อมูลตัวอย่างให้รัน `npm run db:seed` เพิ่มอีกที (ต้องมี Node/npm
   เพื่อรันขั้นตอนนี้เสมอ ไม่มีเวอร์ชัน SQL-only — ข้ามได้ถ้าไม่ต้องการข้อมูลตัวอย่าง)
5. เปิด Realtime สำหรับตาราง queue (Phase 4):
   ```sql
   alter publication supabase_realtime add table queues;
   ```

## 2. เตรียม LINE channels

ต้องสร้าง **สองช่องทางแยกกัน** ภายใต้ LINE Official Account เดียวกันที่
https://developers.line.biz/console/:

- **LINE Login channel** (Phase 2, สำหรับลูกค้า login) — ตั้งค่า callback URL เป็น
  `<NEXTAUTH_URL>/api/auth/callback/line` เก็บ Channel ID/Secret เป็น
  `LINE_CLIENT_ID`/`LINE_CLIENT_SECRET`
- **Messaging API channel** (Phase 9, ส่งแจ้งเตือน) — เปิดใช้งาน "Messaging API" แล้ว copy
  "Channel access token (long-lived)" มาเป็น `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
  (**หมายเหตุ**: LINE Notify ถูกปิดให้บริการไปแล้วตั้งแต่มีนาคม 2025 ระบบนี้จึงใช้ Messaging API
  push message แทน ไม่ใช่ LINE Notify)

ลูกค้าต้อง login ผ่าน LINE Login ก่อนอย่างน้อย 1 ครั้งเพื่อให้ระบบมี `lineUserId` บันทึกไว้ก่อน
ถึงจะส่งแจ้งเตือนหาได้ — เจ้าของร้าน (OWNER) ที่ login ด้วย email/password ต้องผูก LINE user id
ของตัวเองเข้ากับบัญชีด้วยมือ (แก้ตรงๆ ในฐานข้อมูล ยังไม่มี UI ให้ผูกในเฟสนี้) ถ้าต้องการรับสรุปยอด
สิ้นวัน

## 3. Deploy ไป Vercel

1. เชื่อม GitHub repo นี้กับ Vercel project ใหม่ (framework preset: Next.js, auto-detect)
2. ตั้งค่า Environment Variables ทั้งหมดตาม `.env.example` ใน Vercel dashboard (Production +
   Preview): `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_URL`,
   `NEXTAUTH_SECRET`, `LINE_CLIENT_ID`, `LINE_CLIENT_SECRET`,
   `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `CRON_SECRET`
3. `NEXTAUTH_URL` ต้องเป็น URL production จริง (เช่น `https://your-shop.vercel.app`) และต้องอัปเดต
   callback URL ของ LINE Login channel ให้ตรงกันด้วย
4. Deploy — Vercel จะรัน `next build` ให้อัตโนมัติ

## 4. ตั้งค่า Cron

ระบบมี 2 endpoint ที่ต้องรันตามเวลา ทั้งคู่เช็ค header
`Authorization: Bearer $CRON_SECRET` (ดู `src/lib/cron-auth.ts`) — ถ้าไม่ตั้ง `CRON_SECRET`
endpoint จะเปิดสาธารณะ **ห้ามปล่อยแบบนั้นใน production**

- **`/api/cron/daily-summary`** (สรุปยอดขายให้เจ้าของ, ควรรันวันละครั้ง) — ตั้งค่าไว้แล้วใน
  `vercel.json` (`30 15 * * *` = 22:30 เวลาไทย หลังร้านปิดตามเวลาเริ่มต้น) Vercel จะเติม header
  `Authorization: Bearer $CRON_SECRET` ให้เองถ้าตั้งชื่อ env var ตรงกับ `CRON_SECRET` พอดี — ไม่ต้อง
  ทำอะไรเพิ่ม แค่ตั้ง env var นี้ไว้ใน Vercel เท่านั้น
- **`/api/cron/reminders`** (เตือนลูกค้าก่อนถึงคิว, ต้องรันถี่ทุก ~10 นาที) — **Vercel Cron บน
  Hobby plan รันได้แค่วันละครั้งเป็นอย่างน้อย** ถี่กว่านี้ต้อง upgrade เป็น Pro ($20/เดือน ซึ่งเกิน
  งบเป้าหมาย) จึงใช้ **GitHub Actions scheduled workflow** แทน (ฟรี, ไม่จำกัดความถี่จริงจัง) ไฟล์
  `.github/workflows/reminders.yml` รันทุก 10 นาทีอยู่แล้ว แค่ตั้งค่า repo secrets 2 ตัวใน GitHub
  repo settings → Secrets and variables → Actions:
  - `CRON_SECRET` — ค่าเดียวกับที่ตั้งใน Vercel
  - `APP_URL` — URL production เช่น `https://your-shop.vercel.app`

## Production checklist

- [ ] `NEXTAUTH_SECRET` เป็นค่าที่ generate ใหม่ด้วย `openssl rand -base64 32` (ไม่ใช้ค่า dev)
- [ ] ตั้ง `CRON_SECRET` ทั้งใน Vercel และ GitHub repo secrets เป็นค่าเดียวกัน
- [ ] เปิด Point-in-Time Recovery หรืออย่างน้อย daily backup บน Supabase project
      (Dashboard → Database → Backups) — ข้อมูลการเงิน/การจองห้ามสูญหาย
- [ ] ตรวจว่า `DATABASE_URL` ใช้ pooled connection (`pgbouncer=true&connection_limit=1`) —
      serverless function ทุก instance เปิด connection ใหม่ ถ้าไม่ผ่าน pooler จะชน connection
      limit ของ Postgres ได้ง่าย
- [ ] ทดสอบ LINE Login callback URL และ Messaging API token จริงก่อนเปิดใช้งานจริง (ทดสอบใน
      LINE app จริง ไม่ใช่แค่ browser)
- [ ] เปลี่ยนรหัสผ่านบัญชี seed demo (`owner@massageshop.test` ฯลฯ) หรือลบทิ้งก่อนใช้งานจริง —
      ห้ามรันข้อมูล seed ทับข้อมูลจริงซ้ำ
- [ ] เปิด Vercel/Supabase usage alerts เพื่อไม่ให้ค่าใช้จ่ายเกินงบโดยไม่รู้ตัว
- [ ] ตรวจสอบว่า custom domain (ถ้ามี) ตั้งค่า HTTPS ถูกต้องผ่าน Vercel ก่อนอัปเดต `NEXTAUTH_URL`
      และ LINE callback URL ให้ตรงกัน
