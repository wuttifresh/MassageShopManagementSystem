# Feature Prompt: Multi-Channel Booking (WhatsApp Flows + LINE LIFF)

วิธีใช้: วางไฟล์นี้ในโปรเจกต์แล้วสั่ง Claude Code ว่า "อ่าน multi-channel-booking-prompt.md แล้วทำ Phase 1" ทำทีละ Phase, review + test ก่อนขึ้น Phase ถัดไป

## Context

ฉันมีระบบจองคิวร้านนวดอยู่แล้ว (Next.js 14 App Router + Supabase + Prisma) ต้องการเพิ่มช่องทางจองผ่าน WhatsApp Flows และ LINE LIFF โดยใช้ booking logic ร่วมกันทั้งสอง channel

ก่อนเริ่มเขียนโค้ดใดๆ ให้สำรวจ codebase ก่อน:

- อ่าน `prisma/schema.prisma` เพื่อดู model ที่มีอยู่ (Branch, Service, Therapist, Booking, Customer หรือชื่ออื่นที่ใกล้เคียง)
- หา booking logic เดิม (service layer, API routes, หรือ server actions)
- สรุปสิ่งที่พบและ mapping ระหว่างของเดิมกับสิ่งที่ต้องสร้างใหม่ ให้ฉัน confirm ก่อนลงมือ
- ห้ามสร้าง model หรือ service ซ้ำกับของที่มีอยู่ — ให้ extend ของเดิม

## Architecture Target

```
WhatsApp Flow ──▶ /api/whatsapp/flow ──┐
                                       ├──▶ BookingService (shared) ──▶ Prisma/Supabase
LINE LIFF ──────▶ /api/bookings ───────┘
```

## Coding Rules (บังคับทุก Phase)

1. เงินใช้ `Decimal` เท่านั้น ห้าม float
2. Financial records ใช้ soft delete เท่านั้น
3. ทุก booking mutation ต้องลง audit log
4. Timezone ทั้งระบบคือ `Asia/Bangkok` — เก็บ UTC ใน DB, แปลงตอนแสดงผล
5. ห้ามเชื่อ identity จาก client — LINE ต้อง verify ID token กับ LINE server, WhatsApp ต้องผ่าน encrypted channel ของ Meta
6. TypeScript strict mode, ห้ามใช้ `any` ยกเว้น boundary กับ external API
7. Endpoint ที่ใช้ node crypto ต้องประกาศ `export const runtime = 'nodejs'`

## Phase 1 — Channel-Agnostic Booking Service

สร้าง/ปรับ `lib/booking-service.ts` เป็น service layer กลาง:

- `getBranches()`, `getServices(branchId)` — ดึงเฉพาะ active, เรียงตาม sortOrder
- `getAvailableSlots(branchId, serviceId, date)` — คำนวณจาก:
  - shift ของหมอนวดที่มี skill ตรงกับ service
  - booking เดิมที่ status ไม่ใช่ CANCELLED/NO_SHOW
  - ตัด slot ที่เป็นอดีตออก, step 30 นาที, จำกัด 50 slots
- `createBooking(input)` — ต้องมี:
  - Serializable transaction + re-check overlap ก่อน insert
  - upsert Customer ด้วย composite key `(channel, channelUserId)`
  - สร้าง booking code สั้นอ่านง่าย เช่น `BK-XXXX`
  - throw `SlotTakenError` เมื่อชนคิว
- Schema changes ที่อาจต้องทำ (ตรวจกับ schema เดิมก่อน):
  - Customer เพิ่ม `channel` + `channelUserId` พร้อม `@@unique`
  - Booking เพิ่ม `channel`, `code @unique`, index `(therapistId, startTime)`
- เพิ่ม Postgres exclusion constraint กัน overlap ระดับ DB (btree_gist + tsrange) เป็น migration แยก พร้อมคอมเมนต์อธิบาย
- เขียน unit test: slot calculation, overlap detection, concurrent booking

Definition of Done: test ผ่านทั้งหมด, booking เดิมในระบบยังทำงานปกติ

## Phase 2 — Shared REST API (สำหรับ LINE และ web)

สร้าง `app/api/bookings/route.ts`:

- `GET ?meta=branches` / `GET ?meta=services&branchId=` / `GET ?branchId=&serviceId=&date=` → slots
- `POST` สร้าง booking — ต้อง verify LINE ID token จาก `Authorization: Bearer` header กับ `https://api.line.me/oauth2/v2.1/verify` แล้วใช้ `sub` เป็น channelUserId
- `SlotTakenError` → HTTP 409 พร้อม message ภาษาไทย
- Validate input ทุก field, ตอบ 400 เมื่อขาด
- Rate limiting ตาม pattern ที่มีในโปรเจกต์ (ถ้ายังไม่มี ให้เสนอวิธีก่อนทำ)

## Phase 3 — LINE LIFF Booking Page

สร้าง `app/liff/booking/page.tsx`:

- Flow: เลือกสาขา → บริการ → วันที่ (ดึง slot real-time) → กรอกชื่อ/เบอร์ → ยืนยัน → แสดงรหัสจอง
- `liff.init` + auto login, prefill ชื่อจาก LINE profile
- กรณี 409 ให้แจ้งเตือนแล้ว refresh slot อัตโนมัติ
- UI ใช้ design system เดิมของโปรเจกต์ ถ้าไม่มีให้ใช้โทน Soft Warm Minimalist, mobile-first (LIFF เปิดในมือถือเป็นหลัก)
- ENV: `NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ID`

## Phase 4 — WhatsApp Flow Endpoint

สร้าง `app/api/whatsapp/flow/route.ts`:

- รองรับสเปคเข้ารหัสของ Meta: RSA-OAEP(SHA-256) unwrap AES key, AES-128-GCM decrypt payload, ตอบกลับด้วย IV ที่ flip ทุก byte, decrypt ล้มเหลวตอบ HTTP 421
- Handle `action: "ping"` (health check), `action: "INIT"` (ส่งรายชื่อสาขา)
- Screen router: SELECT_BRANCH → SELECT_SERVICE → SELECT_DATETIME (DatePicker trigger ดึง slot) → CONFIRM → SUCCESS
- ระหว่างหน้า CONFIRM ให้ใช้ signed payload token (HMAC) แทนการเชื่อข้อมูลดิบจาก client
- `SlotTakenError` → ส่งกลับหน้า SELECT_DATETIME พร้อม error message
- ENV: `WA_FLOW_PRIVATE_KEY`, `WA_FLOW_PASSPHRASE`
- สร้างไฟล์ `whatsapp/booking-flow.json` (Flow JSON v7.0, data_api_version 3.0) ให้ตรงกับ screen router ทุกหน้าจอ ข้อความ UI เป็นภาษาไทย
- เขียน integration test แบบ mock encryption round-trip

## Phase 5 — Notifications + Webhook Entry Points

- LINE webhook: ลูกค้าพิมพ์ "จอง" → ตอบ Flex Message พร้อมปุ่มเปิด LIFF
- WhatsApp webhook: ลูกค้าทัก → ส่ง interactive flow message (ใส่ wa_id แบบ signed ใน `flow_token`)
- Confirmation message หลังจองสำเร็จ ส่งกลับ channel ที่ลูกค้าจองมา
- Reminder ก่อนถึงคิว 2 ชั่วโมง (cron/Supabase scheduled function) — WhatsApp ใช้ utility template, LINE ใช้ push message
- ทุก outbound message ลง log พร้อม status สำเร็จ/ล้มเหลว

## Phase 6 — Admin Visibility

- หน้า admin เดิม: เพิ่ม column แสดง channel ของแต่ละ booking (badge LINE/WhatsApp/Walk-in)
- Filter booking ตาม channel
- Dashboard: สัดส่วน booking แยกตาม channel รายวัน/รายเดือน

## สิ่งที่ห้ามทำ

- ห้าม hardcode credentials — ทุกอย่างผ่าน ENV และอัปเดต `.env.example`
- ห้ามใช้ edge runtime กับ endpoint ที่มี crypto
- ห้ามข้าม Phase หรือรวมหลาย Phase ใน commit เดียว
- ห้ามแก้ booking logic เดิมโดยไม่แจ้งก่อน — ถ้าจำเป็นต้อง refactor ให้อธิบายเหตุผลและขอ confirm

## Checkpoint ทุก Phase

จบแต่ละ Phase ให้สรุป: ไฟล์ที่สร้าง/แก้, migration ที่รัน, วิธีทดสอบด้วยมือ, และคำถามที่ต้องตัดสินใจก่อน Phase ถัดไป
