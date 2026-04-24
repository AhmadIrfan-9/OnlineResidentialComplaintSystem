import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Fetching all complaints...");
    const complaints = await prisma.complaint.findMany();
    
    console.log("Total complaints in DB:", complaints.length);
    complaints.forEach(c => {
      console.log(`- ID: ${c.id}, Title: ${c.title}, Status: ${c.status}, Category: ${c.category}`);
    });
    
  } catch (error) {
    console.error("Error fetching complaints:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
