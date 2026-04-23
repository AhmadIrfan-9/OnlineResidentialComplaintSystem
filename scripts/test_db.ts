import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true }
  });
  console.log("Users:", users);

  const hostels = await prisma.hostel.findMany({
    select: { id: true, name: true, wardenId: true }
  });
  console.log("Hostels:", hostels);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
