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
    const warningThresholdDays = slaSettings?.warningThresholdDays ?? 30;

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

    // Fetch all admin users once (for escalation notifications)
    const adminUsers = await db.user.findMany({
      where: { role: "IT_STAFF_ADMIN", isActive: true },
      select: { id: true },
    });

    let notifiedCount = 0;
    const now = Date.now();

    for (const complaint of activeComplaints) {
      const daysPending = Math.floor((now - complaint.createdAt.getTime()) / DAY_MS);
      const tId = ticketId(complaint.id, complaint.createdAt);

      // Warden reminder: at or past safe threshold
      if (daysPending >= safeThresholdDays && complaint.hostel.wardenId) {
        const recentNotif = await db.notification.findFirst({
          where: {
            complaintId: complaint.id,
            userId: complaint.hostel.wardenId,
            message: { startsWith: "Reminder: Complaint" },
            createdAt: { gte: new Date(now - DAY_MS) },
          },
          select: { id: true },
        });
        if (!recentNotif) {
          await createInAppNotification({
            userId: complaint.hostel.wardenId,
            complaintId: complaint.id,
            message: `Reminder: Complaint ${tId} has been pending for over ${safeThresholdDays} days.`,
          });
          notifiedCount++;
        }
      }

      // Admin escalation: at or past warning threshold — notify all admins
      if (daysPending >= warningThresholdDays && adminUsers.length > 0) {
        for (const admin of adminUsers) {
          const recentEscalation = await db.notification.findFirst({
            where: {
              complaintId: complaint.id,
              userId: admin.id,
              message: { startsWith: "ESCALATED:" },
              createdAt: { gte: new Date(now - DAY_MS) },
            },
            select: { id: true },
          });
          if (!recentEscalation) {
            await createInAppNotification({
              userId: admin.id,
              complaintId: complaint.id,
              message: `ESCALATED: Complaint ${tId} has been unresolved for ${daysPending} days and requires admin attention.`,
            });
            notifiedCount++;
          }
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
