
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
      },
    });

    console.log("\n=== ALL USERS IN DATABASE ===\n");
    console.table(
      users.map((u) => ({
        Name: u.name,
        Email: u.email,
        Role: u.role,
        Active: u.isActive,
        "Must Change PW": u.mustChangePassword,
        "Password (hashed)": u.password.substring(0, 20) + "...",
        "Last Login": u.lastLoginAt ?? "Never",
      }))
    );

    console.log(`\nTotal users: ${users.length}`);
    console.log("\nNote: Passwords are hashed with bcrypt. Check seed.ts for default passwords.");
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
