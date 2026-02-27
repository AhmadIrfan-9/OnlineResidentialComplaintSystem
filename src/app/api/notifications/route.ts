import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        message: true,
        isRead: true,
        createdAt: true,
        complaintId: true,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[Notifications GET Error]", error);
    return NextResponse.json({ message: "Failed to fetch notifications" }, { status: 500 });
  }
}
