-- Demo/mock data for a fresh database — paste into Supabase SQL Editor and run once, AFTER
-- supabase/deploy.sql has already created the schema. Safe to re-run (every insert uses a fixed
-- id + ON CONFLICT, matching the upsert semantics of prisma/seed.ts).
--
-- This is the SQL-only equivalent of `npm run db:seed` for people who don't have Node installed
-- on the machine doing the Supabase setup. If you do have Node, `npm run db:seed` is the more
-- complete option — this file intentionally mirrors the same demo data (branch, owner/staff/
-- therapist logins, services, a demo customer with a membership + course package) but keep both
-- in sync by hand if you change one.
--
-- All demo accounts use the password: Password123!
-- (bcrypt hash below is precomputed for that password — never reuse it for a real account.)

BEGIN;

-- ============================================================
-- Branch
-- ============================================================
INSERT INTO branches (id, name, slug, address, phone, updated_at)
VALUES (
  'seed-branch-siam',
  'ร้านนวดสยามสแควร์',
  'siam-square',
  '123 ถนนพระราม 1 แขวงปทุมวัน กรุงเทพฯ',
  '0812345678',
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

-- ============================================================
-- Login accounts (OWNER / STAFF / THERAPIST) — all share the password Password123!
-- ============================================================
INSERT INTO users (id, role, name, email, password_hash, phone, updated_at)
VALUES (
  'seed-user-owner',
  'OWNER',
  'คุณเจ้าของร้าน',
  'owner@massageshop.test',
  '$2b$10$Fd5nX.XOUotimjGJ7iKltueLp9.BHtbWH4R7EKiS49D1/UxhMJPwm',
  '0800000001',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO users (id, role, name, email, password_hash, phone, branch_id, updated_at)
VALUES (
  'seed-user-staff',
  'STAFF',
  'พนักงานหน้าร้าน สมศรี',
  'staff@massageshop.test',
  '$2b$10$Fd5nX.XOUotimjGJ7iKltueLp9.BHtbWH4R7EKiS49D1/UxhMJPwm',
  '0800000002',
  'seed-branch-siam',
  now()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO users (id, role, name, email, password_hash, phone, branch_id, updated_at)
VALUES
  ('seed-user-therapist-nok', 'THERAPIST', 'หมอนวด นก', 'nok@massageshop.test',
   '$2b$10$Fd5nX.XOUotimjGJ7iKltueLp9.BHtbWH4R7EKiS49D1/UxhMJPwm', '0800000010', 'seed-branch-siam', now()),
  ('seed-user-therapist-waew', 'THERAPIST', 'หมอนวด แหวว', 'waew@massageshop.test',
   '$2b$10$Fd5nX.XOUotimjGJ7iKltueLp9.BHtbWH4R7EKiS49D1/UxhMJPwm', '0800000011', 'seed-branch-siam', now()),
  ('seed-user-therapist-oi', 'THERAPIST', 'หมอนวด อ้อย', 'oi@massageshop.test',
   '$2b$10$Fd5nX.XOUotimjGJ7iKltueLp9.BHtbWH4R7EKiS49D1/UxhMJPwm', '0800000012', 'seed-branch-siam', now())
ON CONFLICT (phone) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

-- ============================================================
-- Services + duration/price options
-- ============================================================
INSERT INTO services (id, name, category, description, updated_at) VALUES
  ('svc-thai', 'นวดแผนไทย', 'นวด', 'นวดแผนไทยแบบดั้งเดิม คลายกล้ามเนื้อทั่วร่างกาย', now()),
  ('svc-oil', 'นวดน้ำมันอโรมา', 'นวด', 'นวดผ่อนคลายด้วยน้ำมันหอมระเหย', now()),
  ('svc-foot', 'นวดเท้า', 'นวด', 'นวดเท้าเพื่อสุขภาพ', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO service_options (id, service_id, duration_minutes, price, updated_at) VALUES
  ('seed-opt-thai-60', 'svc-thai', 60, 300, now()),
  ('seed-opt-thai-90', 'svc-thai', 90, 450, now()),
  ('seed-opt-thai-120', 'svc-thai', 120, 600, now()),
  ('seed-opt-oil-60', 'svc-oil', 60, 500, now()),
  ('seed-opt-oil-90', 'svc-oil', 90, 700, now()),
  ('seed-opt-foot-60', 'svc-foot', 60, 250, now())
ON CONFLICT (service_id, duration_minutes) DO UPDATE SET
  price = EXCLUDED.price,
  is_active = true,
  updated_at = now();

-- ============================================================
-- Therapist profiles (linked to the THERAPIST user accounts above)
-- ============================================================
INSERT INTO therapists (id, user_id, branch_id, nickname, bio, commission_rate, updated_at) VALUES
  ('seed-therapist-nok', 'seed-user-therapist-nok', 'seed-branch-siam', 'นก',
   'พนักงานนวดมืออาชีพ ประสบการณ์กว่า 5 ปี', 40, now()),
  ('seed-therapist-waew', 'seed-user-therapist-waew', 'seed-branch-siam', 'แหวว',
   'พนักงานนวดมืออาชีพ ประสบการณ์กว่า 5 ปี', 40, now()),
  ('seed-therapist-oi', 'seed-user-therapist-oi', 'seed-branch-siam', 'อ้อย',
   'พนักงานนวดมืออาชีพ ประสบการณ์กว่า 5 ปี', 40, now())
ON CONFLICT (user_id) DO UPDATE SET
  nickname = EXCLUDED.nickname,
  status = 'ACTIVE',
  deleted_at = NULL,
  updated_at = now();

-- Every seeded therapist is eligible for every seeded service.
INSERT INTO therapist_services (therapist_id, service_id)
SELECT t.id, s.id
FROM (VALUES ('seed-therapist-nok'), ('seed-therapist-waew'), ('seed-therapist-oi')) AS t(id)
CROSS JOIN (VALUES ('svc-thai'), ('svc-oil'), ('svc-foot')) AS s(id)
ON CONFLICT (therapist_id, service_id) DO NOTHING;

-- Work schedule for the next 7 days (today through today+6), regenerated relative to whenever
-- this script is run — so booking availability always has something to show right after seeding.
INSERT INTO therapist_schedules (id, therapist_id, branch_id, date, start_time, end_time, status, updated_at)
SELECT
  'seed-schedule-' || t.id || '-' || to_char(d::date, 'YYYYMMDD'),
  t.id,
  t.branch_id,
  d::date,
  '10:00',
  '20:00',
  'WORKING',
  now()
FROM therapists t
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day') AS d
WHERE t.id IN ('seed-therapist-nok', 'seed-therapist-waew', 'seed-therapist-oi')
ON CONFLICT (therapist_id, date) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  status = 'WORKING',
  updated_at = now();

-- ============================================================
-- Demo customer (LINE-login only, no password) with membership + an active course package
-- ============================================================
INSERT INTO users (id, role, name, phone, line_user_id, line_display_name, updated_at)
VALUES (
  'seed-user-customer-somying',
  'CUSTOMER',
  'ลูกค้า สมหญิง ใจดี',
  '0899999999',
  'line-demo-user-001',
  'somying_d',
  now()
)
ON CONFLICT (phone) DO UPDATE SET
  is_active = true,
  deleted_at = NULL,
  updated_at = now();

INSERT INTO memberships (id, customer_id, points, tier, updated_at)
VALUES ('seed-membership-somying', 'seed-user-customer-somying', 120, 'SILVER', now())
ON CONFLICT (customer_id) DO UPDATE SET
  points = EXCLUDED.points,
  tier = EXCLUDED.tier,
  updated_at = now();

INSERT INTO packages (
  id, branch_id, customer_id, service_id, name,
  total_sessions, remaining_sessions, price_paid, sold_by_id, expires_at, updated_at
)
VALUES (
  'seed-package-somying-thai10',
  'seed-branch-siam',
  'seed-user-customer-somying',
  'svc-thai',
  'คอร์สนวดแผนไทย 10 ครั้ง',
  10,
  8,
  2500,
  'seed-user-staff',
  CURRENT_DATE + INTERVAL '6 months',
  now()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================
-- Login credentials (all demo accounts use the same password)
-- ============================================================
-- OWNER:      owner@massageshop.test      / Password123!
-- STAFF:      staff@massageshop.test      / Password123!
-- THERAPIST:  nok@massageshop.test        / Password123!
-- THERAPIST:  waew@massageshop.test       / Password123!
-- THERAPIST:  oi@massageshop.test         / Password123!
-- CUSTOMER:   ลูกค้า สมหญิง ใจดี (0899999999) — LINE Login only, no password
