"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  complaintSubmissionSchema,
  ComplaintStatusEnum,
} from "@/lib/validations";
import { z } from "zod";
import { revalidatePath } from "next/cache";

interface CreateComplaintResult {
  success: boolean;
  data?: {
    id: string;
    title: string;
    roomNumber: string;
    hostelName: string;
  };
  error?: string;
}

export async function createComplaint(
  formData: z.infer<typeof complaintSubmissionSchema>
): Promise<CreateComplaintResult> {
  try {
    // Get current session
    const session = await auth();

    // Check authentication
    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to submit a complaint",
      };
    }

    // Check user role
    if (session.user.role !== "STUDENT") {
      return {
        success: false,
        error: "Only students can submit complaints",
      };
    }

    // Validate input data
    const validatedData = complaintSubmissionSchema.parse(formData);

    // Verify room exists and get hostel info
    const room = await db.room.findUnique({
      where: { id: validatedData.roomId },
      include: {
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!room) {
      return {
        success: false,
        error: "The selected room does not exist",
      };
    }

    // Create complaint in database
    const complaint = await db.complaint.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: validatedData.priority || "MEDIUM",
        status: "OPEN",
        attachments: validatedData.attachments || [],
        studentId: session.user.id,
        hostelId: room.hostelId,
        roomId: validatedData.roomId,
      },
      select: {
        id: true,
        title: true,
        room: {
          select: {
            roomNumber: true,
          },
        },
        hostel: {
          select: {
            name: true,
          },
        },
      },
    });

    // Log the complaint creation
    console.log(
      `[Complaint Created] User: ${session.user.id}, Complaint: ${complaint.id}`
    );

    return {
      success: true,
      data: {
        id: complaint.id,
        title: complaint.title,
        roomNumber: complaint.room.roomNumber,
        hostelName: complaint.hostel.name,
      },
    };
  } catch (error) {
    console.error("[Create Complaint Error]", error);

    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => e.message).join(", ");
      return {
        success: false,
        error: `Validation error: ${fieldErrors}`,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message || "Failed to create complaint",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred while creating the complaint",
    };
  }
}

interface UpdateComplaintStatusResult {
  success: boolean;
  data?: {
    id: string;
    status: string;
    title: string;
  };
  error?: string;
}

export async function updateComplaintStatus(
  complaintId: string,
  newStatus: string
): Promise<UpdateComplaintStatusResult> {
  try {
    // Get current session
    const session = await auth();

    // Check authentication
    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to update complaints",
      };
    }

    // Check user role - only WARDEN and STAFF can update
    if (
      session.user.role !== "WARDEN" &&
      session.user.role !== "STAFF"
    ) {
      return {
        success: false,
        error: "Only wardens and staff can update complaint status",
      };
    }

    // Validate status enum
    const validatedStatus = ComplaintStatusEnum.parse(newStatus);

    // Get the complaint to verify ownership (warden can only update their hostel)
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      include: {
        hostel: {
          select: {
            wardenId: true,
          },
        },
      },
    });

    if (!complaint) {
      return {
        success: false,
        error: "Complaint not found",
      };
    }

    // Authorization check: Warden can only update their hostel's complaints
    if (
      session.user.role === "WARDEN" &&
      complaint.hostel.wardenId !== session.user.id
    ) {
      return {
        success: false,
        error: "You can only update complaints from your assigned hostel",
      };
    }

    // Update the complaint
    const updatedComplaint = await db.complaint.update({
      where: { id: complaintId },
      data: {
        status: validatedStatus,
        assignedToId: session.user.role === "WARDEN" ? session.user.id : undefined,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        title: true,
      },
    });

    // Create a ComplaintUpdate record for the status change
    await db.complaintUpdate.create({
      data: {
        complaintId,
        updateType: "STATUS_CHANGE",
        message: `Status changed to ${validatedStatus}`,
        oldStatus: complaint.status,
        newStatus: validatedStatus,
        updatedById: session.user.id,
      },
    });

    // Revalidate the warden dashboard to show updated data
    revalidatePath("/warden/dashboard");

    console.log(
      `[Complaint Updated] User: ${session.user.id}, Complaint: ${complaintId}, New Status: ${validatedStatus}`
    );

    return {
      success: true,
      data: {
        id: updatedComplaint.id,
        status: updatedComplaint.status,
        title: updatedComplaint.title,
      },
    };
  } catch (error) {
    console.error("[Update Complaint Status Error]", error);

    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map((e) => e.message).join(", ");
      return {
        success: false,
        error: `Validation error: ${fieldErrors}`,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message || "Failed to update complaint status",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred while updating the complaint",
    };
  }
}

interface ComplaintUpdateRecord {
  id: string;
  updateType: string;
  message: string;
  oldStatus: string | null;
  newStatus: string | null;
  createdAt: Date;
  updatedBy: {
    name: string;
    role: string;
    avatar: string | null;
  };
}

export async function getComplaintUpdates(
  complaintId: string
): Promise<{ success: boolean; updates?: ComplaintUpdateRecord[]; error?: string }> {
  try {
    // Get current session
    const session = await auth();

    // Check authentication
    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to view updates",
      };
    }

    // Get the complaint to verify student owns it
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        studentId: true,
      },
    });

    if (!complaint) {
      return {
        success: false,
        error: "Complaint not found",
      };
    }

    // Authorization: Students can only view their own complaints' updates
    // Wardens and staff can view all
    if (
      session.user.role === "STUDENT" &&
      complaint.studentId !== session.user.id
    ) {
      return {
        success: false,
        error: "You can only view updates for your own complaints",
      };
    }

    // Fetch all updates for this complaint
    const updates = await db.complaintUpdate.findMany({
      where: {
        complaintId,
      },
      select: {
        id: true,
        updateType: true,
        message: true,
        oldStatus: true,
        newStatus: true,
        createdAt: true,
        updatedBy: {
          select: {
            name: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      updates,
    };
  } catch (error) {
    console.error("[Get Complaint Updates Error]", error);
    return {
      success: false,
      error: "Failed to fetch complaint updates",
    };
  }
}

interface AddCommentResult {
  success: boolean;
  data?: {
    id: string;
    message: string;
  };
  error?: string;
}

export async function addComplaintComment(
  complaintId: string,
  message: string
): Promise<AddCommentResult> {
  try {
    // Get current session
    const session = await auth();

    // Check authentication
    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to add comments",
      };
    }

    // Check user role - only WARDEN and STAFF can add comments
    if (
      session.user.role !== "WARDEN" &&
      session.user.role !== "STAFF"
    ) {
      return {
        success: false,
        error: "Only wardens and staff can add comments",
      };
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: "Comment cannot be empty",
      };
    }

    if (message.length > 2000) {
      return {
        success: false,
        error: "Comment must not exceed 2000 characters",
      };
    }

    // Get the complaint to verify existence
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      return {
        success: false,
        error: "Complaint not found",
      };
    }

    // Create a ComplaintUpdate record for the comment
    const update = await db.complaintUpdate.create({
      data: {
        complaintId,
        updateType: "COMMENT",
        message: message.trim(),
        updatedById: session.user.id,
      },
      select: {
        id: true,
        message: true,
      },
    });

    // Revalidate paths
    revalidatePath("/complaints");

    console.log(`[Comment Added] User: ${session.user.id}, Complaint: ${complaintId}`);

    return {
      success: true,
      data: {
        id: update.id,
        message: update.message,
      },
    };
  } catch (error) {
    console.error("[Add Comment Error]", error);

    if (error instanceof Error) {
      return {
        success: false,
        error: error.message || "Failed to add comment",
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred while adding the comment",
    };
  }
}
