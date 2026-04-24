"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
const prisma = db; // Keep the 'prisma' alias to avoid changing all usages below
import {
  ComplaintCategoryEnum,
  complaintSubmissionSchema,
  ComplaintStatusEnum,
  type ComplaintSubmissionInput,
} from "@/lib/validations";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { assignmentComment, parseAssignmentText } from "@/lib/complaints";
import { createInAppNotification } from "@/lib/notifications";

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

const createComplaintSubmissionSchema = z
  .object({
    title: z.string().min(5).max(100),
    description: z.string().min(10).max(2000),
    category: ComplaintCategoryEnum,
    locationBlock: z
      .string()
      .regex(/^C[1-3]-(0[1-9]|10)-0[1-8]$/, "Invalid location format")
      .optional(),
    roomId: z.string().min(1),
    studentId: z.string().min(1).optional().nullable(),
    priority: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
    isAnonymous: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.isAnonymous && !value.studentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentId"],
        message: "studentId is required when complaint is not anonymous",
      });
    }
  });

export type CreateComplaintSubmissionInput = z.infer<
  typeof createComplaintSubmissionSchema
>;

interface CreateComplaintSubmissionResult {
  success: boolean;
  data?: {
    id: string;
    title: string;
    category: string;
    locationBlock?: string | null;
    roomId: string;
    studentProfileId: string | null;
    isAnonymous: boolean;
  };
  error?: string;
}

const inferFileTypeFromUrl = (fileUrl: string): string => {
  const cleanUrl = fileUrl.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".png")) return "image/png";
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return "image/jpeg";
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

export async function createComplaintSubmission(
  input: CreateComplaintSubmissionInput
): Promise<CreateComplaintSubmissionResult> {
  try {
    const validatedInput = createComplaintSubmissionSchema.parse(input);

    const room = await prisma.room.findUnique({
      where: { id: validatedInput.roomId },
      select: {
        id: true,
        hostelId: true,
      },
    });

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    // Always look up the student profile so notifications/chat can work
    // even for anonymous complaints. The isAnonymous flag controls UI visibility.
    let studentProfileId: string | null = null;
    if (validatedInput.studentId) {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { id: validatedInput.studentId as string },
        select: { id: true },
      });

      if (!studentProfile && !validatedInput.isAnonymous) {
        return { success: false, error: "Student profile not found" };
      }

      studentProfileId = studentProfile?.id ?? null;
    }

    const complaint = await prisma.complaint.create({
      data: {
        title: validatedInput.title,
        description: validatedInput.description,
        category: validatedInput.category,
        locationBlock: validatedInput.locationBlock ?? null,
        status: "PENDING",
        priority: validatedInput.priority,
        roomId: room.id,
        hostelId: room.hostelId,
        isAnonymous: validatedInput.isAnonymous,
        studentProfileId,
      },
      select: {
        id: true,
        title: true,
        category: true,
        locationBlock: true,
        roomId: true,
        studentProfileId: true,
        isAnonymous: true,
      },
    });

    return { success: true, data: complaint };
  } catch (error) {
    console.error("[Create Complaint Submission Error]", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((issue) => issue.message).join(", "),
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

export async function createComplaint(
  formData: ComplaintSubmissionInput
): Promise<CreateComplaintResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to submit a complaint" };
    }

    if (session.user.role !== "STUDENT") {
      return { success: false, error: "Only students can submit complaints" };
    }

    const validatedData = complaintSubmissionSchema.parse(formData);

    const studentProfile = await db.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!studentProfile) {
      return {
        success: false,
        error: "Student profile not found. Please contact administrator.",
      };
    }

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
      return { success: false, error: "The selected room does not exist" };
    }

    const complaint = await db.complaint.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        locationBlock: validatedData.locationBlock ?? null,
        status: "PENDING",
        priority: validatedData.priority ?? "ROUTINE",
        studentProfileId: studentProfile.id,
        isAnonymous: false,
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

    console.log(`[Complaint Created] User: ${session.user.id}, Complaint: ${complaint.id}`);

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
      return { success: false, error: `Validation error: ${fieldErrors}` };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message || "Failed to create complaint" };
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

interface UpdateComplaintCategoryResult {
  success: boolean;
  data?: {
    id: string;
    category: string;
  };
  error?: string;
}

export async function updateComplaintStatus(
  complaintId: string,
  newStatus: string
): Promise<UpdateComplaintStatusResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to update complaints" };
    }

    if (!isManagementRole(session.user.role) && !isAdminRole(session.user.role)) {
      return {
        success: false,
        error: "Only management users can update complaint status",
      };
    }

    const validatedStatus = ComplaintStatusEnum.parse(newStatus);

    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      include: {
        hostel: {
          select: {
            wardenId: true,
          },
        },
        studentProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!complaint) {
      return { success: false, error: "Complaint not found" };
    }

    // Check if user is a direct warden or has global management access (no specific hostel assignment)
    const isDirectWarden = complaint.hostel.wardenId === session.user.id;
    const assignedHostelCount = await db.hostel.count({
      where: { wardenId: session.user.id }
    });
    const isGlobalManagement = assignedHostelCount === 0;

    if (
      normalizeRoleKey(session.user.role) === "MANAGEMENT" &&
      !isDirectWarden &&
      !isGlobalManagement
    ) {
      return {
        success: false,
        error: "You can only update complaints from your assigned hostel",
      };
    }

    const resolvedAt = validatedStatus === "RESOLVED" ? new Date() : complaint.resolvedAt;
    const closedAt = validatedStatus === "CLOSED" ? new Date() : complaint.closedAt;

    const updatedComplaint = await db.complaint.update({
      where: { id: complaintId },
      data: {
        status: validatedStatus,
        resolvedAt,
        closedAt,
      },
      select: {
        id: true,
        status: true,
        title: true,
      },
    });

    await db.complaintUpdate.create({
      data: {
        complaintId,
        content: `Status changed from ${complaint.status} to ${validatedStatus}`,
        updatedById: session.user.id,
      },
    });

    if (complaint.studentProfile?.userId) {
      await createInAppNotification({
        userId: complaint.studentProfile.userId,
        complaintId,
        message: `Your complaint status was updated to ${validatedStatus}.`,
      });
    }

    revalidatePath("/warden/dashboard");
    revalidatePath("/warden/queue");
    revalidatePath(`/warden/complaints/${complaintId}`);
    revalidatePath("/student/complaints");

    // Phase 6: Auto-embed resolved complaints into the RAG vector store.
    // Dynamic import avoids bundler/TS resolution issues in server actions.
    // Fire-and-forget — never blocks the UI response.
    if (validatedStatus === "RESOLVED") {
      import("@/lib/ai/auto-embed")
        .then(({ embedAndStoreResolvedComplaint }) =>
          embedAndStoreResolvedComplaint(complaintId)
        )
        .catch((err: unknown) =>
          console.warn(
            "[AI] Auto-embed failed (non-critical):",
            err instanceof Error ? err.message : err
          )
        );
    }

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
      return { success: false, error: `Validation error: ${fieldErrors}` };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message || "Failed to update complaint status" };
    }

    return {
      success: false,
      error: "An unexpected error occurred while updating the complaint",
    };
  }
}

export async function updateComplaintCategory(
  complaintId: string,
  newCategory: string
): Promise<UpdateComplaintCategoryResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to update complaints" };
    }

    if (!isManagementRole(session.user.role) && !isAdminRole(session.user.role)) {
      return {
        success: false,
        error: "Only management users can update complaint category",
      };
    }

    const validatedCategory = ComplaintCategoryEnum.parse(newCategory);

    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      include: {
        hostel: {
          select: {
            wardenId: true,
          },
        },
        studentProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!complaint) {
      return { success: false, error: "Complaint not found" };
    }

    const isDirectWarden = complaint.hostel.wardenId === session.user.id;
    const assignedHostelCount = await db.hostel.count({
      where: { wardenId: session.user.id }
    });
    const isGlobalManagement = assignedHostelCount === 0;

    if (!isDirectWarden && !isGlobalManagement) {
      return {
        success: false,
        error: "You can only update complaints from your assigned hostel",
      };
    }

    const updatedComplaint = await db.complaint.update({
      where: { id: complaintId },
      data: { category: validatedCategory },
      select: {
        id: true,
        category: true,
      },
    });

    await db.complaintUpdate.create({
      data: {
        complaintId,
        content: `Category changed from ${complaint.category} to ${validatedCategory}`,
        updatedById: session.user.id,
      },
    });

    if (complaint.studentProfile?.userId) {
      await createInAppNotification({
        userId: complaint.studentProfile.userId,
        complaintId,
        message: `Your complaint category was updated to ${validatedCategory}.`,
      });
    }

    revalidatePath("/warden/dashboard");
    revalidatePath("/warden/queue");
    revalidatePath(`/warden/complaints/${complaintId}`);

    return {
      success: true,
      data: {
        id: updatedComplaint.id,
        category: updatedComplaint.category,
      },
    };
  } catch (error) {
    console.error("[Update Complaint Category Error]", error);
    return {
      success: false,
      error: "Failed to update complaint category",
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

const parseStatusTransition = (content: string): { oldStatus: string | null; newStatus: string | null } => {
  const match = content.match(/^Status changed from ([A-Z_]+) to ([A-Z_]+)$/);
  if (!match) {
    return { oldStatus: null, newStatus: null };
  }
  return { oldStatus: match[1], newStatus: match[2] };
};

export async function getComplaintUpdates(
  complaintId: string
): Promise<{ success: boolean; updates?: ComplaintUpdateRecord[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to view updates" };
    }

    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        studentProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!complaint) {
      return { success: false, error: "Complaint not found" };
    }

    if (session.user.role === "STUDENT" && complaint.studentProfile?.userId !== session.user.id) {
      return {
        success: false,
        error: "You can only view updates for your own complaints",
      };
    }

    const updates = await db.complaintUpdate.findMany({
      where: { complaintId },
      select: {
        id: true,
        content: true,
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

    const mappedUpdates: ComplaintUpdateRecord[] = updates.map((update) => {
      const isStatusChange = update.content.startsWith("Status changed from ");
      const isAssignment = parseAssignmentText(update.content) !== null;
      const parsed = parseStatusTransition(update.content);
      return {
        id: update.id,
        updateType: isStatusChange
          ? "STATUS_CHANGE"
          : isAssignment
          ? "ASSIGNMENT"
          : "COMMENT",
        message: update.content,
        oldStatus: parsed.oldStatus,
        newStatus: parsed.newStatus,
        createdAt: update.createdAt,
        updatedBy: {
          name: update.updatedBy.name,
          role: String(update.updatedBy.role),
          avatar: update.updatedBy.avatar,
        },
      };
    });

    return {
      success: true,
      updates: mappedUpdates,
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
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to add comments" };
    }

    if (!message || message.trim().length === 0) {
      return { success: false, error: "Comment cannot be empty" };
    }

    if (message.length > 2000) {
      return { success: false, error: "Comment must not exceed 2000 characters" };
    }

    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        hostel: { select: { wardenId: true } },
        studentProfile: { select: { userId: true } },
      },
    });

    if (!complaint) {
      return { success: false, error: "Complaint not found" };
    }

    const normalizedRole = normalizeRoleKey(session.user.role);
    const isWardenOwner =
      normalizedRole === "MANAGEMENT" && complaint.hostel.wardenId === session.user.id;
    const isStudentOwner =
      normalizedRole === "STUDENT" && complaint.studentProfile?.userId === session.user.id;

    if (!isWardenOwner && !isStudentOwner) {
      return {
        success: false,
        error: "You are not allowed to comment on this complaint",
      };
    }

    const update = await db.complaintUpdate.create({
      data: {
        complaintId,
        content: message.trim(),
        updatedById: session.user.id,
      },
      select: {
        id: true,
        content: true,
      },
    });

    if (normalizedRole === "MANAGEMENT" && complaint.studentProfile?.userId) {
      await createInAppNotification({
        userId: complaint.studentProfile.userId,
        complaintId,
        message: "Management sent you a new complaint message.",
      });
    }

    if (normalizedRole === "STUDENT" && complaint.hostel.wardenId) {
      await createInAppNotification({
        userId: complaint.hostel.wardenId,
        complaintId,
        message: "Student sent a new message on a complaint.",
      });
    }

    revalidatePath("/student/complaints");

    console.log(`[Comment Added] User: ${session.user.id}, Complaint: ${complaintId}`);

    return {
      success: true,
      data: {
        id: update.id,
        message: update.content,
      },
    };
  } catch (error) {
    console.error("[Add Comment Error]", error);

    if (error instanceof Error) {
      return { success: false, error: error.message || "Failed to add comment" };
    }

    return {
      success: false,
      error: "An unexpected error occurred while adding the comment",
    };
  }
}

interface AssignComplaintResult {
  success: boolean;
  data?: {
    complaintId: string;
    assignedTo: string;
  };
  error?: string;
}

export async function assignComplaint(
  complaintId: string,
  assignee: string
): Promise<AssignComplaintResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "You must be logged in to assign complaints" };
    }

    if (!isManagementRole(session.user.role) && !isAdminRole(session.user.role)) {
      return { success: false, error: "Only management users can assign complaints" };
    }

    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      include: {
        hostel: { select: { wardenId: true } },
        studentProfile: { select: { userId: true } },
      },
    });

    if (!complaint) {
      return { success: false, error: "Complaint not found" };
    }

    const isDirectWarden = complaint.hostel.wardenId === session.user.id;
    const assignedHostelCount = await db.hostel.count({
      where: { wardenId: session.user.id }
    });
    const isGlobalManagement = assignedHostelCount === 0;

    if (!isDirectWarden && !isGlobalManagement) {
      return { success: false, error: "You can only assign complaints from your assigned hostel" };
    }

    const assignedTo = assignee.trim() || "Unassigned";
    await db.complaintUpdate.create({
      data: {
        complaintId,
        content: assignmentComment(assignedTo),
        updatedById: session.user.id,
      },
    });

    if (complaint.studentProfile?.userId) {
      await createInAppNotification({
        userId: complaint.studentProfile.userId,
        complaintId,
        message: `Your complaint was assigned to ${assignedTo}.`,
      });
    }

    revalidatePath("/warden/queue");
    revalidatePath(`/warden/complaints/${complaintId}`);

    return {
      success: true,
      data: {
        complaintId,
        assignedTo,
      },
    };
  } catch (error) {
    console.error("[Assign Complaint Error]", error);
    return { success: false, error: "Failed to assign complaint" };
  }
}
