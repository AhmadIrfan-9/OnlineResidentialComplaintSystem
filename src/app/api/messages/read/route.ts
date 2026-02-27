import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessComplaint, resolveComplaintMessagingContext } from "@/lib/messaging";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { complaintId?: string };
    const complaintId = String(body.complaintId ?? "").trim();
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

    const result = await db.supportMessage.updateMany({
      where: {
        complaintId: context.complaintId,
        recipientId: session.user.id,
        readStatus: false,
      },
      data: {
        readStatus: true,
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("[Messages Read PATCH Error]", error);
    return NextResponse.json({ message: "Failed to update read status" }, { status: 500 });
  }
}
