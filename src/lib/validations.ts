import { z } from "zod";

// Complaint Category enum - matches Prisma
export const ComplaintCategoryEnum = z.enum([
  "PLUMBING",
  "WIFI",
  "ELECTRIC",
  "CLEANING",
  "FURNITURE",
  "MAINTENANCE",
  "NOISE",
  "SECURITY",
  "OTHER",
]);

export type ComplaintCategory = z.infer<typeof ComplaintCategoryEnum>;

// Priority enum
export const PriorityEnum = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);

export type Priority = z.infer<typeof PriorityEnum>;

// Complaint Status enum - matches Prisma
export const ComplaintStatusEnum = z.enum([
  "SUBMITTED",
  "ACKNOWLEDGED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export type ComplaintStatus = z.infer<typeof ComplaintStatusEnum>;

// Complaint submission schema
export const complaintSubmissionSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must not exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must not exceed 2000 characters"),
  category: ComplaintCategoryEnum.refine(
    (val) => val !== undefined,
    "Please select a category"
  ),
  priority: PriorityEnum.default("ROUTINE"),
  roomId: z.string().min(1, "Room is required"),
  attachments: z
    .array(z.string().url("Invalid image URL"))
    .optional()
    .default([]),
  isAnonymous: z.boolean().optional().default(false),
});

export type ComplaintSubmissionInput = z.input<
  typeof complaintSubmissionSchema
>;

// Complaint update schema (for staff/warden)
export const complaintUpdateSchema = z.object({
  status: ComplaintStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  resolution: z
    .string()
    .min(10, "Resolution must be at least 10 characters")
    .max(2000, "Resolution must not exceed 2000 characters")
    .optional(),
});

export type ComplaintUpdateInput = z.infer<typeof complaintUpdateSchema>;

// Category display names
export const categoryLabels: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing",
  WIFI: "WiFi & Internet",
  ELECTRIC: "Electrical",
  CLEANING: "Cleaning",
  FURNITURE: "Furniture",
  MAINTENANCE: "Maintenance",
  NOISE: "Noise",
  SECURITY: "Security",
  OTHER: "Other",
};

// Priority display with colors
export const priorityLabels: Record<Priority, string> = {
  ROUTINE: "Routine",
  URGENT: "Urgent",
  EMERGENCY: "Emergency",
};

export const priorityColors: Record<Priority, string> = {
  ROUTINE: "bg-green-100 text-green-800",
  URGENT: "bg-yellow-100 text-yellow-800",
  EMERGENCY: "bg-red-100 text-red-800",
};

// Status display with colors
export const statusLabels: Record<ComplaintStatus, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const statusColors: Record<ComplaintStatus, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  ACKNOWLEDGED: "bg-indigo-100 text-indigo-800",
  UNDER_REVIEW: "bg-purple-100 text-purple-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};
