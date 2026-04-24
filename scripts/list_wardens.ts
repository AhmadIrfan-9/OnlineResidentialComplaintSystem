import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Fetching wardens and their hostels...");
    const wardens = await prisma.user.findMany({
      where: { role: "MANAGEMENT" },
      select: {
        id: true,
        name: true,
        email: true,
        wardenHostels: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log("Wardens found:", wardens.length);
    console.log(JSON.stringify(wardens, null, 2));

    const allHostels = await prisma.hostel.findMany({
      include: {
        warden: {
          select: {
            name: true,
          },
        },
      },
    });
    console.log("\nAll Hostels:");
    console.log(JSON.stringify(allHostels, null, 2));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
