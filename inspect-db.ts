import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log("Checking columns for student_profiles table...")
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'student_profiles'
    `
    console.log("Columns found:", JSON.stringify(columns, null, 2))
  } catch (e) {
    console.error("Error querying schema:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
