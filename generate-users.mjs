import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { hash } from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Manually parse .env
const envPath = join(__dirname, ".env");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  try {
    console.log("Generating users in database...");
    const defaultPassword = "uni10pass!";
    const passwordHash = await hash(defaultPassword, 10);

    // 1. Create/Upsert Admin User
    const admin = await prisma.user.upsert({
      where: { email: "admin@orcs.local" },
      update: {
        name: "System Admin",
        role: "IT_STAFF_ADMIN",
        password: passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      create: {
        email: "admin@orcs.local",
        name: "System Admin",
        password: passwordHash,
        role: "IT_STAFF_ADMIN",
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`✅ Admin upserted: ${admin.email} (Role: ${admin.role})`);

    // 2. Create/Upsert Management User
    const management = await prisma.user.upsert({
      where: { email: "management@orcs.local" },
      update: {
        name: "Hostel Management",
        role: "MANAGEMENT",
        password: passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      create: {
        email: "management@orcs.local",
        name: "Hostel Management",
        password: passwordHash,
        role: "MANAGEMENT",
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`✅ Management upserted: ${management.email} (Role: ${management.role})`);

    // 3. Create/Upsert Hostel "Cendikiawan" and link to Warden/Management
    const hostel = await prisma.hostel.upsert({
      where: { name: "Cendikiawan" },
      update: { wardenId: management.id },
      create: {
        name: "Cendikiawan",
        wardenId: management.id,
      },
    });
    console.log(`✅ Hostel Cendikiawan created/updated with warden: ${management.name}`);

    // 4. Create/Upsert Room "C1-01-01" under "Cendikiawan"
    const room = await prisma.room.upsert({
      where: {
        roomNumber_hostelId: {
          roomNumber: "C1-01-01",
          hostelId: hostel.id,
        },
      },
      update: {
        floor: 1,
      },
      create: {
        roomNumber: "C1-01-01",
        floor: 1,
        hostelId: hostel.id,
      },
    });
    console.log(`✅ Room C1-01-01 created/updated`);

    // 5. Create/Upsert Student User
    const student = await prisma.user.upsert({
      where: { email: "student@orcs.local" },
      update: {
        name: "Student User",
        role: "STUDENT",
        password: passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      create: {
        email: "student@orcs.local",
        name: "Student User",
        password: passwordHash,
        role: "STUDENT",
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`✅ Student upserted: ${student.email} (Role: ${student.role})`);

    // 6. Create/Upsert Student Profile for the Student User and assign Room
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: student.id },
      update: {
        roomId: room.id,
        studentId: "SW012345",
      },
      create: {
        userId: student.id,
        roomId: room.id,
        studentId: "SW012345",
      },
    });
    console.log(`✅ Student Profile created/updated (Student ID: ${studentProfile.studentId})`);

    // 7. Seed extra rooms just to populate the select inputs in complaint form
    console.log("Seeding extra rooms...");
    const blocks = ["C1", "C2", "C3"];
    const floors = [1, 2, 3];
    const units = [1, 2, 3, 4];
    const roomsToCreate = [];
    
    for (const block of blocks) {
      for (const floor of floors) {
        for (const unit of units) {
          const floorStr = floor.toString().padStart(2, "0");
          const unitStr = unit.toString().padStart(2, "0");
          roomsToCreate.push({
            roomNumber: `${block}-${floorStr}-${unitStr}`,
            floor: floor,
            hostelId: hostel.id,
          });
        }
      }
    }

    await prisma.room.createMany({
      data: roomsToCreate,
      skipDuplicates: true,
    });
    console.log("✅ Seeded extra block rooms successfully.");
    console.log("\n=== SUMMARY ===");
    console.log("All accounts initialized successfully!");
    console.log(`- ADMIN:      email: admin@orcs.local      password: ${defaultPassword}`);
    console.log(`- MANAGEMENT: email: management@orcs.local password: ${defaultPassword}`);
    console.log(`- STUDENT:    email: student@orcs.local    password: ${defaultPassword}  studentId: SW012345`);
    console.log("================\n");

  } catch (e) {
    console.error("Error creating users:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
