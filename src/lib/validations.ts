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
  locationBlock: z
    .string()
    .regex(/^C[1-3]-(0[1-9]|10)-0[1-8]$/, "Invalid location format")
    .optional(),
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
