import { db } from "@/lib/db";
import { normalizeRoleKey } from "@/lib/roles";

export type ChatRole = "STUDENT" | "MANAGEMENT";

export type MessagePayload = {
  messageId: string;
  complaintId: string;
  studentId: string;
  senderId: string;
  senderRole: ChatRole;
  recipientId: string;
  content: string;
  contentType: string;
  timestamp: string;
  readStatus: boolean;
};

export const roomNameForStudent = (studentId: string): string => `student:${studentId}`;
export const roomNameForComplaint = (complaintId: string): string =>
  `complaint:${complaintId}`;
export const managementRoomName = (): string => "management:support";

export const toChatRole = (role: unknown): ChatRole => {
  const normalized = normalizeRoleKey(role);
  return normalized === "STUDENT" ? "STUDENT" : "MANAGEMENT";
};

export const canAccessStudentRoom = (
  requesterRole: unknown,
  requesterUserId: string,
  studentId: string
): boolean => {
  const normalized = normalizeRoleKey(requesterRole);
  if (normalized === "STUDENT") return requesterUserId === studentId;
  return normalized === "MANAGEMENT" || normalized === "IT_STAFF_ADMIN";
};

export const canAccessComplaint = (
  requesterRole: unknown,
  requesterUserId: string,
  complaint: {
    studentProfile: { userId: string } | null;
    hostel: { wardenId: string };
  }
): boolean => {
  const normalized = normalizeRoleKey(requesterRole);
  if (normalized === "STUDENT") {
    return complaint.studentProfile?.userId === requesterUserId;
  }
  if (normalized === "MANAGEMENT") {
    return complaint.hostel.wardenId === requesterUserId;
  }
  return normalized === "IT_STAFF_ADMIN";
};

export const serializeMessage = (message: {
  messageId: string;
  complaintId: string;
  studentId: string;
  senderId: string;
  senderRole: "STUDENT" | "MANAGEMENT";
  recipientId: string;
  content: string;
  contentType: string;
  timestamp: Date;
  readStatus: boolean;
}): MessagePayload => ({
  messageId: message.messageId,
  complaintId: message.complaintId,
  studentId: message.studentId,
  senderId: message.senderId,
  senderRole: message.senderRole,
  recipientId: message.recipientId,
  content: message.content,
  contentType: message.contentType,
  timestamp: message.timestamp.toISOString(),
  readStatus: message.readStatus,
});

export const findPrimaryManagementRecipientForStudent = async (
  studentUserId: string
): Promise<string | null> => {
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: {
      room: {
        select: {
          hostel: {
            select: {
              wardenId: true,
            },
          },
        },
      },
    },
  });

  return studentProfile?.room?.hostel?.wardenId ?? null;
};

export const resolveComplaintMessagingContext = async (complaintId: string) => {
  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      studentProfile: {
        select: {
          userId: true,
        },
      },
      hostel: {
        select: {
          wardenId: true,
        },
      },
    },
  });

  if (!complaint) {
    return null;
  }

  return {
    complaintId: complaint.id,
    // null when the complaint was filed anonymously (no linked student profile)
    studentId: complaint.studentProfile?.userId ?? null,
    managementRecipientId: complaint.hostel.wardenId,
    complaint,
  };
};
