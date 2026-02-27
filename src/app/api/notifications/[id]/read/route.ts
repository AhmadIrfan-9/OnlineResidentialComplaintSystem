import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, isRead: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "Notification not found" }, { status: 404 });
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!existing.isRead) {
      await db.notification.update({
        where: { id: existing.id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("[Notifications Read PATCH Error]", error);
    return NextResponse.json(
      { message: "Failed to update notification" },
      { status: 500 }
    );
  }
}
