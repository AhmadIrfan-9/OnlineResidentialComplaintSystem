/// <reference types="node" />
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@orcs.local" },
    update: {
      name: "System Admin",
      role: "IT_STAFF_ADMIN",
      isActive: true,
    },
    create: {
      email: "admin@orcs.local",
      name: "System Admin",
      password: defaultPasswordHash,
      role: "IT_STAFF_ADMIN",
      isActive: true,
    },
  });

  const management = await prisma.user.upsert({
    where: { email: "management@orcs.local" },
    update: {
      name: "Hostel Management",
      role: "MANAGEMENT",
      isActive: true,
    },
    create: {
      email: "management@orcs.local",
      name: "Hostel Management",
      password: defaultPasswordHash,
      role: "MANAGEMENT",
      isActive: true,
    },
  });

  const hostel = await prisma.hostel.upsert({
    where: { name: "Cendikiawan" },
    update: { wardenId: management.id },
    create: {
      name: "Cendikiawan",
      wardenId: management.id,
    },
  });

  const blocks = ["C1", "C2", "C3"];
  const floors = Array.from({ length: 10 }, (_, i) => i + 1);
  const units = Array.from({ length: 8 }, (_, i) => i + 1);

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

  const studentRoom = await prisma.room.findFirst({
    where: { roomNumber: "C1-01-01", hostelId: hostel.id },
  });

  if (!studentRoom) throw new Error("Failed to seed room C1-01-01");

  const student = await prisma.user.upsert({
    where: { email: "user@orcs.local" },
    update: {
      name: "Student User",
      role: "STUDENT",
      isActive: true,
    },
    create: {
      email: "user@orcs.local",
      name: "Student User",
      password: defaultPasswordHash,
      role: "STUDENT",
      isActive: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: { roomId: studentRoom.id },
    create: {
      userId: student.id,
      roomId: studentRoom.id,
      studentId: "SW012345",
    },
  });

  console.log("Seed completed.");
  console.log(`ADMIN: ${admin.email} (role: IT_STAFF_ADMIN)`);
  console.log(`MANAGEMENT: ${management.email} (role: MANAGEMENT)`);
  console.log(`USER: ${student.email} (role: STUDENT)`);
  console.log("Default password for all seeded users: password123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
