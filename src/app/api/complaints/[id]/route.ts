import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roles";
import { ComplaintCategoryEnum } from "@/lib/validations";
import { resolveEvidenceListUrls } from "@/lib/storage/evidence";

const studentUpdateSchema = z.object({
  title: z.string().min(5).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  category: ComplaintCategoryEnum.optional(),
  isAnonymous: z.boolean().optional(),
});

const STUDENT_EDITABLE_STATUSES = new Set(["PENDING"]);

const complaintScopeWhere = async (userId: string, role: string) => {
  if (role === "STUDENT") {
    const studentProfile = await db.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!studentProfile) return null;
    return { studentProfileId: studentProfile.id };
  }
  if (role === "MANAGEMENT") {
    return { hostel: { wardenId: userId } };
  }
  return {};
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const role = normalizeRoleKey(session.user.role);
    const scope = await complaintScopeWhere(session.user.id, role);
    if (scope === null) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const complaint = await db.complaint.findFirst({
      where: { id, ...scope },
      include: {
        room: { select: { id: true, roomNumber: true, floor: true } },
        hostel: { select: { id: true, name: true } },
        evidences: { select: { id: true, fileUrl: true, fileType: true } },
        studentProfile: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    const resolvedEvidences = await resolveEvidenceListUrls(complaint.evidences);

    return NextResponse.json({
      complaint: {
        ...complaint,
        evidences: resolvedEvidences,
        student: complaint.studentProfile?.user ?? null,
        attachments: resolvedEvidences.map((evidence) => evidence.fileUrl),
      },
    });
  } catch (error) {
    console.error("[Complaint GET By ID Error]", error);
    return NextResponse.json({ message: "Failed to fetch complaint" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = normalizeRoleKey(session.user.role);
    if (role !== "STUDENT") {
      return NextResponse.json(
        { message: "Only students can edit complaints here" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const payload = studentUpdateSchema.parse(await request.json());
    const scope = await complaintScopeWhere(session.user.id, role);
    if (scope === null) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const complaint = await db.complaint.findFirst({
      where: { id, ...scope },
      select: { id: true, status: true },
    });

    if (!complaint) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }
    if (!STUDENT_EDITABLE_STATUSES.has(complaint.status)) {
      return NextResponse.json(
        { message: "Complaint can only be edited when status is Pending" },
        { status: 409 }
      );
    }

    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: payload,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        isAnonymous: true,
        status: true,
        updatedAt: true,
      },
    });

    await db.complaintUpdate.create({
      data: {
        complaintId: complaint.id,
        updatedById: session.user.id,
        content: "Complaint details edited by student",
      },
    });

    return NextResponse.json({ complaint: updated, message: "Complaint updated" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Complaint PATCH By ID Error]", error);
    return NextResponse.json({ message: "Failed to update complaint" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = normalizeRoleKey(session.user.role);
    const { id } = await params;

    if (role === "IT_STAFF_ADMIN") {
      await db.complaint.delete({ where: { id } });
      return NextResponse.json({ message: "Complaint deleted by admin" });
    }

    if (role !== "STUDENT") {
      return NextResponse.json(
        { message: "Only student owner or admin can delete complaint" },
        { status: 403 }
      );
    }

    const scope = await complaintScopeWhere(session.user.id, role);
    if (scope === null) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const complaint = await db.complaint.findFirst({
      where: { id, ...scope },
      select: { id: true, status: true },
    });

    if (!complaint) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }
    if (!STUDENT_EDITABLE_STATUSES.has(complaint.status)) {
      return NextResponse.json(
        { message: "Complaint can only be deleted when status is Pending" },
        { status: 409 }
      );
    }

    await db.complaint.delete({ where: { id: complaint.id } });
    return NextResponse.json({ message: "Complaint deleted" });
  } catch (error) {
    console.error("[Complaint DELETE By ID Error]", error);
    return NextResponse.json({ message: "Failed to delete complaint" }, { status: 500 });
  }
}
