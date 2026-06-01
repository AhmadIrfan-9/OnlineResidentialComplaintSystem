import { z } from "zod";

// ─── Complaint Status enum ── 4 logical workflow states (matches Prisma) ──────
//
//  PENDING      → New ticket or Assigned — awaiting management action
//  IN_PROGRESS  → Work on-site underway
//  RESOLVED     → Fix complete, awaiting student verification
//  CLOSED       → Finalized / archived
//
export const ComplaintStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);

export type ComplaintStatus = z.infer<typeof ComplaintStatusEnum>;

// Priority enum
export const PriorityEnum = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);
export type Priority = z.infer<typeof PriorityEnum>;

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
  category: z.string().min(1, "Please select a category"),
  locationBlock: z
    .string()
    .min(1, "Location is required")
    .optional(),
  roomId: z.string().min(1, "Room is required"),
  priority: PriorityEnum.optional().default("ROUTINE"),
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
  resolution: z
    .string()
    .min(10, "Resolution must be at least 10 characters")
    .max(2000, "Resolution must not exceed 2000 characters")
    .optional(),
  priority: PriorityEnum.optional(),
});

export type ComplaintUpdateInput = z.infer<typeof complaintUpdateSchema>;

// ─── Status display ────────────────────────────────────────────────────────────
// Human-friendly labels
export const statusLabels: Record<ComplaintStatus, string> = {
  PENDING:     "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED:    "Resolved",
  CLOSED:      "Closed",
};

// Status pill color map (Tailwind CSS classes)
//  PENDING     → Amber / Yellow  — waiting, needs attention
//  IN_PROGRESS → Blue            — active work on-site
//  RESOLVED    → Green           — fix done, awaiting verification
//  CLOSED      → Gray            — archived / finalized
export const statusColors: Record<ComplaintStatus, string> = {
  PENDING:     "bg-amber-100 text-amber-800 border border-amber-200",
  IN_PROGRESS: "bg-blue-100  text-blue-800  border border-blue-200",
  RESOLVED:    "bg-green-100 text-green-800 border border-green-200",
  CLOSED:      "bg-gray-100  text-gray-700  border border-gray-200",
};
