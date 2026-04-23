import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInAppNotification } from "@/lib/notifications";

const DAY_MS = 1000 * 60 * 60 * 24;

const ticketId = (id: string, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = `${createdAt.getMonth() + 1}`.padStart(2, "0");
  const d = `${createdAt.getDate()}`.padStart(2, "0");
  return `ORCS-${y}${m}${d}-${id.slice(0, 4).toUpperCase()}`;
};

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Checking complaint aging...");

    const slaSettings = await db.adminSlaSetting.findFirst();
    const safeThresholdDays = slaSettings?.safeThresholdDays ?? 14;

    const activeComplaints = await db.complaint.findMany({
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

    console.log(`[Cron] Aging check complete. Sent ${notifiedCount} notifications.`);
    return NextResponse.json({ success: true, notifiedCount });
  } catch (error) {
    console.error("[Cron] Aging check failed:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
