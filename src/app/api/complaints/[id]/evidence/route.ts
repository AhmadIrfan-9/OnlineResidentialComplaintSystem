import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roles";
import { storageService } from "@/lib/storage/StorageService";

export const runtime = "nodejs";

const createEvidenceSchema = z.object({
  key: z.string().min(1, "Evidence key is required"),
  fileType: z.string().min(1, "File type is required"),
});

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = createEvidenceSchema.parse(await request.json());
    const { id } = await params;

    const role = normalizeRoleKey(session.user.role);
    const scope = await complaintScopeWhere(session.user.id, role);
    if (scope === null) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const complaint = await db.complaint.findFirst({
      where: { id, ...scope },
      select: { id: true },
    });

    if (!complaint) {
      return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    }

    const parsedKey = storageService.parseObjectKey(payload.key);
    if (!parsedKey) {
      return NextResponse.json(
        { message: "Invalid evidence key format. Expected complaintId/fileUuid.ext" },
        { status: 400 }
      );
    }

    if (parsedKey.complaintId !== complaint.id) {
      return NextResponse.json(
        { message: "Evidence key complaintId does not match target complaint." },
        { status: 409 }
      );
    }

    const evidence = await db.evidence.create({
      data: {
        complaintId: complaint.id,
        fileUrl: parsedKey.key,
        fileType: payload.fileType,
      },
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
      },
    });

    return NextResponse.json({ message: "Evidence linked", evidence }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    console.error("[Complaint Evidence POST Error]", error);
    return NextResponse.json({ message: "Failed to link evidence" }, { status: 500 });
  }
}
