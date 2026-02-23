import { db } from "./src/lib/db";

async function main() {
  const users = await db.user.findMany({
    where: {
      OR: [
        { id: "cmlv6fxvi000134igoku9lhkc" },
        { id: "cmlv6iopb000434igsb5u1ll6" },
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      studentProfile: { select: { id: true, roomId: true } },
      wardenHostels: { select: { id: true, name: true } },
    },
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
