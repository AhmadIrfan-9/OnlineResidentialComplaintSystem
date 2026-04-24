import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userId = "cmo0axdqb0006igzsip6y2gg2"; // Student User
  
  try {
    console.log("Checking student profile...");
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    
    if (!studentProfile) {
      console.log("Student profile not found");
      return;
    }
    
    console.log("Fetching complaints for studentProfileId:", studentProfile.id);
    const complaints = await prisma.complaint.findMany({
      where: { studentProfileId: studentProfile.id },
      include: {
        studentProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
          },
        },
        evidences: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    
    console.log("Fetched complaints count:", complaints.length);
    console.log("Complaints sample:", JSON.stringify(complaints[0], null, 2));
    
  } catch (error) {
    console.error("Error fetching complaints:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
