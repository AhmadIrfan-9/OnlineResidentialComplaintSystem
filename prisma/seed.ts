import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Clean up existing data (optional - comment out if you want to preserve)
  await prisma.complaintUpdate.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.room.deleteMany();
  await prisma.hostel.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Cleaned existing data\n");

  // Create Warden User
  const warden = await prisma.user.create({
    data: {
      email: "warden@residential.edu",
      password:
        "$2b$10$3HQLKqNp9xZX3gLdP5pQ4e3K3i3i3i3i3i3i3i3i3i3i3i3i3i3i", // bcrypt hash (password: "password123")
      name: "Dr. Sarah Johnson",
      role: "WARDEN",
      phone: "+60391234567",
    },
  });

  console.log(`✅ Created Warden: ${warden.name} (${warden.email})`);

  // Create North Hall Hostel
  const northHall = await prisma.hostel.create({
    data: {
      name: "North Hall",
      wardenId: warden.id,
    },
  });

  console.log(`✅ Created Hostel: ${northHall.name}`);

  // Create South Hall Hostel
  const southHall = await prisma.hostel.create({
    data: {
      name: "South Hall",
      wardenId: warden.id,
    },
  });

  console.log(`✅ Created Hostel: ${southHall.name}\n`);

  // Create 5 rooms for North Hall
  console.log("📍 Creating rooms for North Hall...");
  const northRooms = [];
  for (let i = 1; i <= 5; i++) {
    const room = await prisma.room.create({
      data: {
        roomNumber: `${100 + i}`,
        floor: Math.ceil(i / 2),
        hostelId: northHall.id,
      },
    });
    northRooms.push(room);
    console.log(`   - Room ${room.roomNumber} (Floor ${room.floor})`);
  }

  // Create 5 rooms for South Hall
  console.log("\n📍 Creating rooms for South Hall...");
  const southRooms = [];
  for (let i = 1; i <= 5; i++) {
    const room = await prisma.room.create({
      data: {
        roomNumber: `${200 + i}`,
        floor: Math.ceil(i / 2),
        hostelId: southHall.id,
      },
    });
    southRooms.push(room);
    console.log(`   - Room ${room.roomNumber} (Floor ${room.floor})`);
  }

  // Create Student User
  const student = await prisma.user.create({
    data: {
      email: "student@residential.edu",
      password:
        "$2b$10$3HQLKqNp9xZX3gLdP5pQ4e3K3i3i3i3i3i3i3i3i3i3i3i3i3i3i", // bcrypt hash (password: "password123")
      name: "Ahmad Ali",
      role: "STUDENT",
      phone: "+60391234568",
    },
  });

  console.log(`\n✅ Created Student: ${student.name} (${student.email})`);

  // Create StudentProfile and assign to Room 101 (first room in North Hall)
  const studentProfile = await prisma.studentProfile.create({
    data: {
      userId: student.id,
      roomId: northRooms[0].id, // Room 101
    },
  });

  console.log(
    `✅ Created Student Profile: ${student.name} → Room ${northRooms[0].roomNumber} in ${northHall.name}\n`
  );

  // Summary
  console.log("=" + "=".repeat(49) + "=");
  console.log("🎉 Database seeding completed successfully!");
  console.log("=" + "=".repeat(49) + "=");
  console.log("\n📊 Summary:");
  console.log(`   • Users: 2 (1 Warden, 1 Student)`);
  console.log(`   • Hostels: 2`);
  console.log(`   • Rooms: 10 (5 per hostel)`);
  console.log(`   • Student Profiles: 1`);
  console.log("\n🔐 Test Credentials:");
  console.log(`   Warden:`);
  console.log(`   - Email: ${warden.email}`);
  console.log(`   - Password: password123`);
  console.log(`\n   Student:`);
  console.log(`   - Email: ${student.email}`);
  console.log(`   - Password: password123`);
  console.log(`   - Room: ${northRooms[0].roomNumber} in ${northHall.name}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
