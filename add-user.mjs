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
    const passwordHash = await hash("TestUser123!", 10);
    
    const newUser = await prisma.user.upsert({
      where: { email: "testuser@orcs.local" },
      update: {},
      create: {
        email: "testuser@orcs.local",
        name: "Test User",
        password: passwordHash,
        role: "STUDENT",
        isActive: true,
      },
    });
    
    // Add student profile for the new user so they can login and not be "trapped in missing profile loop" if any
    try {
        await prisma.studentProfile.upsert({
            where: { userId: newUser.id },
            update: {},
            create: {
                userId: newUser.id,
                studentId: "SW000000",
            }
        });
        console.log("Student Profile added successfully.");
    } catch (profileError) {
        console.error("Could not add student profile (it may already exist or need other relations):", profileError.message);
    }
    
    console.log("New user added successfully:");
    console.log("Name:", newUser.name);
    console.log("Email:", newUser.email);
    console.log("Role:", newUser.role);
    console.log("Password: TestUser123!");
    
  } catch (e) {
    console.error("Error creating user:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
