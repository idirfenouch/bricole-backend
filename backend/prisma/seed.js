// ─────────────────────────────────────────────────────────
// BRICOLE — Seed Script
// Seeds the database with categories and an admin user
// ─────────────────────────────────────────────────────────

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
require("dotenv").config();

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Plomberie", icon: "droplets" },
  { name: "Électricité", icon: "zap" },
  { name: "Peinture", icon: "paintbrush" },
  { name: "Maçonnerie", icon: "brick-wall" },
  { name: "Menuiserie", icon: "door-open" },
  { name: "Climatisation", icon: "thermometer" },
  { name: "Carrelage", icon: "grid-3x3" },
  { name: "Rénovation", icon: "hammer" },
  { name: "Serrurerie", icon: "key-round" },
  { name: "Nettoyage", icon: "sparkles" },
  { name: "Jardinage", icon: "flower-2" },
  { name: "Déménagement", icon: "truck" },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Categories ──
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon },
      create: cat,
    });
  }
  console.log(`✅ ${CATEGORIES.length} categories seeded`);

  // ── Admin user ──
  const adminEmail = process.env.ADMIN_EMAIL || "admin@bricole.dz";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin1234!";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        fullName: "Administrateur BRICOLE",
        email: adminEmail,
        passwordHash: hash,
        role: "admin",
        phone: "0000000000",
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // ── Demo Professional ──
  const proEmail = "karim.b@demo.dz";
  const existingPro = await prisma.user.findUnique({ where: { email: proEmail } });

  if (!existingPro) {
    const hash = await bcrypt.hash("Demo1234!", 12);
    const proUser = await prisma.user.create({
      data: {
        fullName: "Karim Benali",
        email: proEmail,
        passwordHash: hash,
        role: "pro",
        phone: "0555123456",
      },
    });
    await prisma.professionalProfile.create({
      data: {
        userId: proUser.id,
        bio: "Plombier qualifié avec 10 ans d'expérience à Blida. Spécialisé en réparation de fuites, installation sanitaire et débouchage.",
        metiers: JSON.stringify(["Plomberie"]),
        ville: "Blida",
        experienceYears: 10,
        verified: true,
        subscriptionStatus: "active",
      },
    });
    console.log(`✅ Demo professional created: ${proEmail}`);
  } else {
    console.log(`ℹ️  Demo professional already exists: ${proEmail}`);
  }

  // ── Demo Particulier ──
  const partEmail = "amina.d@demo.dz";
  const existingPart = await prisma.user.findUnique({ where: { email: partEmail } });

  if (!existingPart) {
    const hash = await bcrypt.hash("Demo1234!", 12);
    await prisma.user.create({
      data: {
        fullName: "Amina Djebbari",
        email: partEmail,
        passwordHash: hash,
        role: "particulier",
        phone: "0661987654",
      },
    });
    console.log(`✅ Demo particulier created: ${partEmail}`);
  } else {
    console.log(`ℹ️  Demo particulier already exists: ${partEmail}`);
  }

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
