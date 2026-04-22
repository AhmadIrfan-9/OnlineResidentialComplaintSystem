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

  const room = await prisma.room.upsert({
    where: {
      roomNumber_hostelId: {
        roomNumber: "A-101",
        hostelId: hostel.id,
      },
    },
    update: {
      floor: 1,
      hostelId: hostel.id,
    },
    create: {
      roomNumber: "A-101",
      floor: 1,
      hostelId: hostel.id,
    },
  });

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
    update: { roomId: room.id },
    create: {
      userId: student.id,
      roomId: room.id,
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
