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

const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.user.updateMany({
      data: {
        mustChangePassword: false
      }
    });
    console.log("Updated", res.count, "users to mustChangePassword = false");
  } catch (e) {
    console.error("Error updating passwords:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
