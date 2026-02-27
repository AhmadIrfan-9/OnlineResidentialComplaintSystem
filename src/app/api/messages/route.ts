import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canAccessComplaint,
  roomNameForComplaint,
  roomNameForStudent,
  resolveComplaintMessagingContext,
  serializeMessage,
  toChatRole,
} from "@/lib/messaging";
import { createInAppNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const complaintId = String(searchParams.get("complaintId") ?? "").trim();
    const limit = Math.min(100, Number.parseInt(searchParams.get("limit") ?? "50", 10));

    if (!complaintId) {
      return NextResponse.json({ message: "complaintId is required" }, { status: 400 });
    }

    const context = await resolveComplaintMessagingContext(complaintId);
    if (!context) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    if (!canAccessComplaint(session.user.role, session.user.id, context.complaint)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const rows = await db.supportMessage.findMany({
      where: { complaintId: context.complaintId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return NextResponse.json({
      messages: rows.reverse().map(serializeMessage),
    });
  } catch (error) {
    console.error("[Messages GET Error]", error);
    return NextResponse.json({ message: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      complaintId?: string;
      content?: string;
      contentType?: string;
    };

    const complaintId = String(body.complaintId ?? "").trim();
    const content = String(body.content ?? "").trim();
    const contentType = String(body.contentType ?? "TEXT").trim().toUpperCase();

    if (!complaintId || !content) {
      return NextResponse.json(
        { message: "complaintId and content are required" },
        { status: 400 }
      );
    }

    const context = await resolveComplaintMessagingContext(complaintId);
    if (!context) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    if (!canAccessComplaint(session.user.role, session.user.id, context.complaint)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const senderRole = toChatRole(session.user.role);
    const recipientId =
      senderRole === "STUDENT"
        ? context.managementRecipientId
        : context.studentId;

    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });
    if (!recipient) {
      return NextResponse.json({ message: "recipientId not found" }, { status: 404 });
    }

    const created = await db.supportMessage.create({
      data: {
        complaintId: context.complaintId,
        studentId: context.studentId,
        senderId: session.user.id,
        senderRole,
        recipientId,
        content,
        contentType,
      },
    });

    if (senderRole === "MANAGEMENT") {
      await createInAppNotification({
        userId: context.studentId,
        complaintId: context.complaintId,
        message: "Management sent you a new support message.",
      });
    } else {
      await createInAppNotification({
        userId: context.managementRecipientId,
        complaintId: context.complaintId,
        message: "A student sent you a new support message.",
      });
    }

    try {
      const io = (globalThis as typeof globalThis & { __orcsIo?: import("socket.io").Server })
        .__orcsIo;
      if (io) {
        const serialized = serializeMessage(created);
        io.to(roomNameForStudent(context.studentId)).emit("message:new", serialized);
        io.to(roomNameForComplaint(context.complaintId)).emit("message:new", serialized);
      }
    } catch {
      // optional realtime emit path
    }

    return NextResponse.json({ message: serializeMessage(created) }, { status: 201 });
  } catch (error) {
    console.error("[Messages POST Error]", error);
    return NextResponse.json({ message: "Failed to send message" }, { status: 500 });
  }
}
