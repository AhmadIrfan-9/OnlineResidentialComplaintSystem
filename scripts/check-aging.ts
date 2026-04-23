import { PrismaClient } from "@prisma/client";
import { createInAppNotification } from "../src/lib/notifications";

const prisma = new PrismaClient();
const DAY_MS = 1000 * 60 * 60 * 24;

const ticketId = (id: string, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = `${createdAt.getMonth() + 1}`.padStart(2, "0");
  const d = `${createdAt.getDate()}`.padStart(2, "0");
  return `ORCS-${y}${m}${d}-${id.slice(0, 4).toUpperCase()}`;
};

async function main() {
  console.log("Checking complaint aging...");

  const slaSettings = await prisma.adminSlaSetting.findFirst();
  const safeThresholdDays = slaSettings?.safeThresholdDays ?? 14;

  const activeComplaints = await prisma.complaint.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      hostel: {
        select: {
          wardenId: true,
        },
      },
    },
  });

  let notifiedCount = 0;
  const now = Date.now();

  for (const complaint of activeComplaints) {
    const daysPending = Math.floor((now - complaint.createdAt.getTime()) / DAY_MS);

    // Trigger exactly when it crosses the safe threshold
    if (daysPending === safeThresholdDays) {
      if (complaint.hostel.wardenId) {
        const tId = ticketId(complaint.id, complaint.createdAt);
        await createInAppNotification({
          userId: complaint.hostel.wardenId,
          complaintId: complaint.id,
          message: `Reminder: Complaint ${tId} has been pending for over ${safeThresholdDays} days.`,
        });
        notifiedCount++;
      }
    }
  }

  console.log(`Aging check complete. Sent ${notifiedCount} notifications.`);
}

main()
  .catch((e) => {
    console.error("Aging check failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
