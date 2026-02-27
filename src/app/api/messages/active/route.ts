import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = normalizeRoleKey(session.user.role);
    if (role !== "MANAGEMENT" && role !== "IT_STAFF_ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    let complaintScope: { complaintId?: { in: string[] } } = {};
    if (role === "MANAGEMENT") {
      const complaintIds = await db.complaint.findMany({
        where: {
          hostel: {
            wardenId: session.user.id,
          },
        },
        select: { id: true },
      });
      complaintScope = {
        complaintId: { in: complaintIds.map((item) => item.id) },
      };
    }

    const grouped = await db.supportMessage.groupBy({
      where: complaintScope,
      by: ["studentId", "complaintId"],
      _max: { timestamp: true },
      orderBy: { _max: { timestamp: "desc" } },
      take: 100,
    });

    const summaries = await Promise.all(
      grouped.map(async (group) => {
        const latestMessage = await db.supportMessage.findFirst({
          where: { studentId: group.studentId, complaintId: group.complaintId },
          orderBy: { timestamp: "desc" },
        });

        const student = await db.user.findUnique({
          where: { id: group.studentId },
          select: { id: true, name: true, email: true },
        });

        const unreadCount = await db.supportMessage.count({
          where: {
            studentId: group.studentId,
            complaintId: group.complaintId,
            recipientId: session.user.id,
            readStatus: false,
          },
        });

        const complaint = await db.complaint.findUnique({
          where: { id: group.complaintId },
          select: { id: true, title: true },
        });

        return {
          studentId: group.studentId,
          complaintId: group.complaintId,
          complaintTitle: complaint?.title ?? "Complaint",
          studentName: student?.name ?? "Unknown Student",
          studentEmail: student?.email ?? "",
          unreadCount,
          latestMessage: latestMessage
            ? {
                messageId: latestMessage.messageId,
                content: latestMessage.content,
                timestamp: latestMessage.timestamp.toISOString(),
                senderRole: latestMessage.senderRole,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ chats: summaries });
  } catch (error) {
    console.error("[Active Chats GET Error]", error);
    return NextResponse.json({ message: "Failed to fetch active chats" }, { status: 500 });
  }
}
