import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log("Diagnostic check starting...")
  try {
    const tableExists = await prisma.$queryRaw`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_profiles')`
    console.log("Table exists:", tableExists)
    
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'student_profiles'
    `
    console.log("Columns in student_profiles:", columns)
  } catch (err) {
    console.error("Diagnostic failed:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
