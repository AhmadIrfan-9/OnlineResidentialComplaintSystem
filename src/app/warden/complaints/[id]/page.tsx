import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { ManagementComplaintDetailClient } from "@/components/warden/ManagementComplaintDetailClient";
import { parseAssignmentText, toAgeBand, toPendingDays } from "@/lib/complaints";

const pretty = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const ticketId = (id: string, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = `${createdAt.getMonth() + 1}`.padStart(2, "0");
  const d = `${createdAt.getDate()}`.padStart(2, "0");
  return `ORCS-${y}${m}${d}-${id.slice(0, 4).toUpperCase()}`;
};

export default async function ManagementComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || !isManagementRole(role)) {
    redirect("/login");
  }

  const complaint = await db.complaint.findUnique({
    where: { id },
    include: {
      hostel: { select: { id: true, name: true, wardenId: true } },
      room: { select: { roomNumber: true, floor: true } },
      studentProfile: {
        include: {
          user: {
            select: { name: true, email: true, phone: true },
          },
        },
      },
      evidences: { select: { id: true, fileUrl: true, fileType: true } },
      complaintUpdates: {
        orderBy: { createdAt: "asc" },
        include: {
          updatedBy: { select: { name: true, role: true } },
        },
      },
    },
  });

  if (!complaint) {
    notFound();
  }

  if (role === "MANAGEMENT" && complaint.hostel.wardenId !== session.user.id) {
    redirect("/warden/queue");
  }

  const assignees = await db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["MANAGEMENT", "IT_STAFF_ADMIN"] },
    },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  const daysPending = toPendingDays(complaint.createdAt);
  const ageBand = toAgeBand(daysPending);
  const assignedTo =
    complaint.complaintUpdates
      .slice()
      .reverse()
      .map((update) => parseAssignmentText(update.content))
      .find((value): value is string => Boolean(value)) ?? "Unassigned";

  const detail = {
    id: complaint.id,
    ticketId: ticketId(complaint.id, complaint.createdAt),
    studentName: complaint.isAnonymous
      ? "Anonymous"
      : complaint.studentProfile?.user.name ?? "Unknown",
    studentIdentifier: complaint.isAnonymous
      ? "Not displayed"
      : complaint.studentProfile?.user.email ?? "Unavailable",
    hostelName: complaint.hostel.name,
    contact: complaint.isAnonymous
      ? "Access via message system only"
      : `${complaint.studentProfile?.user.email ?? "N/A"} | ${
          complaint.studentProfile?.user.phone ?? "N/A"
        }`,
    submissionMode: complaint.isAnonymous ? ("Anonymous" as const) : ("Identified" as const),
    submittedAt: complaint.createdAt.toISOString(),
    categoryCode: complaint.category,
    categoryOptions: [
      "PLUMBING",
      "WIFI",
      "ELECTRIC",
      "CLEANING",
      "FURNITURE",
      "MAINTENANCE",
      "NOISE",
      "SECURITY",
      "OTHER",
    ],
    category: pretty(complaint.category),
    severity: pretty(complaint.priority),
    status: complaint.status,
    daysPending,
    ageBand,
    assignedTo,
    assigneeOptions: ["Unassigned", ...assignees.map((item) => item.name)],
    updatedAt: complaint.updatedAt.toISOString(),
    description: complaint.description,
    isAnonymous: complaint.isAnonymous,
    evidence: complaint.evidences,
    updates: complaint.complaintUpdates.map((u) => ({
      id: u.id,
      createdAt: u.createdAt.toISOString(),
      content: u.content,
      role: u.updatedBy.role,
      name: u.updatedBy.name,
    })),
  };

  return (
    <main className="min-h-screen p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="surface-hero p-4">
          <h1 className="text-lg font-semibold text-slate-900">Complaint Detail - Management View</h1>
          <p className="text-sm text-slate-600">{detail.ticketId}</p>
        </header>
        <ManagementComplaintDetailClient detail={detail} />
      </div>
    </main>
  );
}
