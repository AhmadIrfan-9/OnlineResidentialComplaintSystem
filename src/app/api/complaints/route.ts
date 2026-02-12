import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { complaintSubmissionSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only students can submit complaints
    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { message: "Only students can submit complaints" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedData = complaintSubmissionSchema.parse(body);

    // Verify room exists
    const room = await db.room.findUnique({
      where: { id: validatedData.roomId },
      include: { hostel: true },
    });

    if (!room) {
      return NextResponse.json(
        { message: "Room not found" },
        { status: 404 }
      );
    }

    // Create complaint
    const complaint = await db.complaint.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: validatedData.priority,
        status: "OPEN",
        attachments: validatedData.attachments || [],
        studentId: session.user.id,
        hostelId: room.hostelId,
        roomId: validatedData.roomId,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
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
      },
    });

    // Log activity (optional - implement if you have an activity log)
    console.log(`[Complaint Created] ${session.user.id} - ${complaint.id}`);

    return NextResponse.json(
      {
        id: complaint.id,
        message: "Complaint submitted successfully",
        complaint,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Complaint API Error]", error);

    // Handle validation errors
    if (error instanceof Error && error.message.includes("Validation")) {
      return NextResponse.json(
        { message: "Invalid input data", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Failed to submit complaint" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const hostelId = searchParams.get("hostelId");
    const studentId = searchParams.get("studentId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = parseInt(searchParams.get("skip") || "0");

    // Build query filters based on role
    const where: Record<string, unknown> = {};

    if (session.user.role === "STUDENT") {
      // Students can only see their own complaints
      where.studentId = session.user.id;
    } else if (session.user.role === "WARDEN") {
      // Wardens can see complaints in their hostel(s)
      where.hostel = {
        wardenId: session.user.id,
      };
    } else if (session.user.role === "STAFF") {
      // Staff can see all complaints or assigned ones (adjust as needed)
      // For now, show all if no filter is applied
    }

    // Apply optional filters
    if (status) where.status = status;
    if (category) where.category = category;
    if (hostelId) where.hostelId = hostelId;
    if (studentId && session.user.role !== "STUDENT") {
      where.studentId = studentId;
    }

    // Fetch complaints
    const complaints = await db.complaint.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip,
    });

    // Get total count
    const total = await db.complaint.count({ where });

    return NextResponse.json(
      {
        complaints,
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

    return NextResponse.json(
      { message: "Failed to fetch complaints" },
      { status: 500 }
    );
  }
}
