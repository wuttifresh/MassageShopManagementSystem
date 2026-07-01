import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  const branch = await prisma.branch.upsert({
    where: { slug: "siam-square" },
    update: {},
    create: {
      name: "ร้านนวดสยามสแควร์",
      slug: "siam-square",
      address: "123 ถนนพระราม 1 แขวงปทุมวัน กรุงเทพฯ",
      phone: "0812345678",
      openTime: "10:00",
      closeTime: "22:00",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@massageshop.test" },
    update: {},
    create: {
      role: "OWNER",
      name: "คุณเจ้าของร้าน",
      email: "owner@massageshop.test",
      phone: "0800000001",
      branchId: null,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@massageshop.test" },
    update: {},
    create: {
      role: "STAFF",
      name: "พนักงานหน้าร้าน สมศรี",
      email: "staff@massageshop.test",
      phone: "0800000002",
      branchId: branch.id,
    },
  });

  const therapistUsers = await Promise.all(
    [
      { name: "หมอนวด นก", phone: "0800000010", nickname: "นก" },
      { name: "หมอนวด แหวว", phone: "0800000011", nickname: "แหวว" },
      { name: "หมอนวด อ้อย", phone: "0800000012", nickname: "อ้อย" },
    ].map((t) =>
      prisma.user.upsert({
        where: { phone: t.phone },
        update: {},
        create: {
          role: "THERAPIST",
          name: t.name,
          phone: t.phone,
          branchId: branch.id,
        },
      })
    )
  );

  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "svc-thai" },
      update: {},
      create: {
        id: "svc-thai",
        name: "นวดแผนไทย",
        category: "นวด",
        description: "นวดแผนไทยแบบดั้งเดิม คลายกล้ามเนื้อทั่วร่างกาย",
        options: {
          create: [
            { durationMinutes: 60, price: 300 },
            { durationMinutes: 90, price: 450 },
            { durationMinutes: 120, price: 600 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.service.upsert({
      where: { id: "svc-oil" },
      update: {},
      create: {
        id: "svc-oil",
        name: "นวดน้ำมันอโรมา",
        category: "นวด",
        description: "นวดผ่อนคลายด้วยน้ำมันหอมระเหย",
        options: {
          create: [
            { durationMinutes: 60, price: 500 },
            { durationMinutes: 90, price: 700 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.service.upsert({
      where: { id: "svc-foot" },
      update: {},
      create: {
        id: "svc-foot",
        name: "นวดเท้า",
        category: "นวด",
        description: "นวดเท้าเพื่อสุขภาพ",
        options: {
          create: [{ durationMinutes: 60, price: 250 }],
        },
      },
      include: { options: true },
    }),
  ]);

  const thaiMassage = services[0];

  const therapists = await Promise.all(
    therapistUsers.map((u, i) =>
      prisma.therapist.upsert({
        where: { userId: u.id },
        update: {},
        create: {
          userId: u.id,
          branchId: branch.id,
          nickname: ["นก", "แหวว", "อ้อย"][i],
          bio: "พนักงานนวดมืออาชีพ ประสบการณ์กว่า 5 ปี",
          commissionType: "PERCENTAGE",
          commissionRate: 40,
          specialties: {
            create: services.map((s) => ({ serviceId: s.id })),
          },
        },
      })
    )
  );

  const today = new Date();
  const isoDate = (d: Date) => new Date(d.toISOString().slice(0, 10));

  for (const therapist of therapists) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      await prisma.therapistSchedule.upsert({
        where: { therapistId_date: { therapistId: therapist.id, date: isoDate(date) } },
        update: {},
        create: {
          therapistId: therapist.id,
          branchId: branch.id,
          date: isoDate(date),
          startTime: "10:00",
          endTime: "20:00",
          status: "WORKING",
        },
      });
    }
  }

  const customer = await prisma.user.upsert({
    where: { phone: "0899999999" },
    update: {},
    create: {
      role: "CUSTOMER",
      name: "ลูกค้า สมหญิง ใจดี",
      phone: "0899999999",
      lineUserId: "line-demo-user-001",
      lineDisplayName: "somying_d",
    },
  });

  await prisma.membership.upsert({
    where: { customerId: customer.id },
    update: {},
    create: {
      customerId: customer.id,
      points: 120,
      tier: "SILVER",
    },
  });

  const existingPackage = await prisma.package.findFirst({
    where: { customerId: customer.id, name: "คอร์สนวดแผนไทย 10 ครั้ง" },
  });

  if (!existingPackage) {
    await prisma.package.create({
      data: {
        branchId: branch.id,
        customerId: customer.id,
        serviceId: thaiMassage.id,
        name: "คอร์สนวดแผนไทย 10 ครั้ง",
        totalSessions: 10,
        remainingSessions: 8,
        pricePaid: 2500,
        status: "ACTIVE",
        soldById: staff.id,
        expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  Branch:      ${branch.name} (${branch.id})`);
  console.log(`  Owner:       ${owner.email}`);
  console.log(`  Staff:       ${staff.email}`);
  console.log(`  Therapists:  ${therapists.map((t) => t.nickname).join(", ")}`);
  console.log(`  Services:    ${services.map((s) => s.name).join(", ")}`);
  console.log(`  Customer:    ${customer.name} (${customer.phone})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
