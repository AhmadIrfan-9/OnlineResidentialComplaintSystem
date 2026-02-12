import { z } from "zod";

// Complaint Category enum - matches Prisma
export const ComplaintCategoryEnum = z.enum([
  "PLUMBING",
  "WIFI",
  "ELECTRICAL",
  "FURNITURE",
  "MAINTENANCE",
  "CLEANLINESS",
  "NOISE",
  "SECURITY",
  "OTHER",
]);

export type ComplaintCategory = z.infer<typeof ComplaintCategoryEnum>;

// Priority enum
export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export type Priority = z.infer<typeof PriorityEnum>;

// Complaint Status enum - matches Prisma
export const ComplaintStatusEnum = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
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
  priority: PriorityEnum.default("MEDIUM"),
  roomId: z.string().uuid("Invalid room ID"),
  attachments: z
    .array(z.string().url("Invalid image URL"))
    .optional()
    .default([]),
});

export type ComplaintSubmissionInput = z.infer<
  typeof complaintSubmissionSchema
>;

// Complaint update schema (for staff/warden)
export const complaintUpdateSchema = z.object({
  status: ComplaintStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedToId: z.string().uuid().optional().nullable(),
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
  ELECTRICAL: "Electrical",
  FURNITURE: "Furniture",
  MAINTENANCE: "Maintenance",
  CLEANLINESS: "Cleanliness",
  NOISE: "Noise",
  SECURITY: "Security",
  OTHER: "Other",
};

// Priority display with colors
export const priorityLabels: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "Urgent",
};

export const priorityColors: Record<Priority, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-red-100 text-red-800",
};

// Status display with colors
export const statusLabels: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export const statusColors: Record<ComplaintStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-purple-100 text-purple-800",
  IN_PROGRESS: "bg-orange-100 text-orange-800",
  RESOLVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};
