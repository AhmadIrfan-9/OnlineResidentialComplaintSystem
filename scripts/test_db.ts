import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const users = await prisma.user.findMany({ take: 1 })
    console.log('Connection successful, found user:', users.length)
    
    // Check if student_profiles table has studentId column
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'student_profiles';
    `
    console.log('Columns in student_profiles:', JSON.stringify(columns, null, 2))
  } catch (e) {
    console.error('Connection failed:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
