import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "found" : "NOT SET");

const prisma = new PrismaClient({
  log: ["error"],
});

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, password: true },
    });
    console.log("\n=== USERS IN DATABASE (" + users.length + " found) ===");
    if (users.length === 0) {
      console.log("NO USERS FOUND - database may be empty or seed was not run");
    }
    users.forEach((u) => {
      console.log(`  Name:     ${u.name}`);
      console.log(`  Email:    ${u.email}`);
      console.log(`  Role:     ${u.role}`);
      console.log(`  Active:   ${u.isActive}`);
      console.log(`  Password: ${u.password ? "SET" : "NOT SET"}`);
      console.log("  ---");
    });
  } catch (e) {
    console.error("DB Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
