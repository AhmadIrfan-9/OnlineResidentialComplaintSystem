import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { complaintSubmissionSchema } from "@/lib/validations";
import { normalizeRoleKey } from "@/lib/roles";
import { resolveEvidenceListUrls } from "@/lib/storage/evidence";

const inferFileTypeFromUrl = (fileUrl: string): string => {
  const cleanUrl = fileUrl.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { message: "Only students can submit complaints" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = complaintSubmissionSchema.parse(body);

    const studentProfile = await db.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!studentProfile) {
      return NextResponse.json(
        { message: "Student profile not found" },
        { status: 404 }
      );
    }

    const room = await db.room.findUnique({
      where: { id: validatedData.roomId },
      include: { hostel: true },
    });

    if (!room) {
      return NextResponse.json({ message: "Room not found" }, { status: 404 });
    }

    const complaint = await db.complaint.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: "ROUTINE",
        locationBlock: validatedData.locationBlock ?? null,
        status: "SUBMITTED",
        studentProfileId: studentProfile.id,
        isAnonymous: validatedData.isAnonymous,
        hostelId: room.hostelId,
        roomId: validatedData.roomId,
        evidences: validatedData.attachments?.length
          ? {
              create: validatedData.attachments.map((fileUrl) => ({
                fileUrl,
                fileType: inferFileTypeFromUrl(fileUrl),
              })),
            }
          : undefined,
      },
      include: {
        studentProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        room: {
          select: {
            roomNumber: true,
            floor: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
        evidences: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
      },
    });

    const resolvedEvidences = await resolveEvidenceListUrls(complaint.evidences);

    console.log(`[Complaint Created] ${session.user.id} - ${complaint.id}`);

    return NextResponse.json(
      {
        id: complaint.id,
        message: "Complaint submitted successfully",
        complaint: {
          ...complaint,
          evidences: resolvedEvidences,
          student: complaint.studentProfile?.user ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Complaint API Error]", error);
    if (error instanceof Error && error.message.includes("Validation")) {
      return NextResponse.json(
        { message: "Invalid input data", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Failed to submit complaint" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const hostelId = searchParams.get("hostelId");
    const studentId = searchParams.get("studentId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = parseInt(searchParams.get("skip") || "0");

    const where: Record<string, unknown> = {};

    const role = normalizeRoleKey(session.user.role);

    if (role === "STUDENT") {
      const studentProfile = await db.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!studentProfile) {
        return NextResponse.json(
          { message: "Student profile not found", complaints: [] },
          { status: 200 }
        );
      }

      where.studentProfileId = studentProfile.id;
    } else if (role === "MANAGEMENT") {
      where.hostel = { wardenId: session.user.id };
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (hostelId) where.hostelId = hostelId;
    if (studentId && role !== "STUDENT") {
      where.studentProfileId = studentId;
    }

    const complaints = await db.complaint.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
          },
        },
        evidences: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip,
    });

    const normalizedComplaints = await Promise.all(
      complaints.map(async (complaint) => {
        const resolvedEvidences = await resolveEvidenceListUrls(complaint.evidences);
        return {
          ...complaint,
          evidences: resolvedEvidences,
          student: complaint.studentProfile?.user ?? null,
          attachments: resolvedEvidences.map((evidence) => evidence.fileUrl),
        };
      })
    );

    const total = await db.complaint.count({ where });

    return NextResponse.json(
      {
        complaints: normalizedComplaints,
        pagination: {
          total,
          limit,
          skip,
          hasMore: skip + limit < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Complaints GET Error]", error);
    return NextResponse.json({ message: "Failed to fetch complaints" }, { status: 500 });
  }
}
