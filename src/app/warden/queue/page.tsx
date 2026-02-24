import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { ComplaintQueueTable, type QueueItem } from "@/components/warden/ComplaintQueueTable";
import { parseAssignmentText, toAgeBand, toPendingDays } from "@/lib/complaints";

const categoryLabel = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const statusLabel = categoryLabel;

const ticketId = (id: string, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = `${createdAt.getMonth() + 1}`.padStart(2, "0");
  const d = `${createdAt.getDate()}`.padStart(2, "0");
  return `ORCS-${y}${m}${d}-${id.slice(0, 4).toUpperCase()}`;
};

export default async function ComplaintQueuePage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || !isManagementRole(role)) {
    redirect("/login");
  }

  const hostel = await db.hostel.findFirst({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
  });

  if (!hostel) {
    redirect("/warden/dashboard");
  }

  const complaints = await db.complaint.findMany({
    where: { hostelId: hostel.id },
    include: {
      studentProfile: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      complaintUpdates: {
        orderBy: { createdAt: "desc" },
        select: {
          content: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const items: QueueItem[] = complaints.map((c) => {
    const pendingDays = toPendingDays(c.createdAt, now);
    const ageBand = toAgeBand(pendingDays);
    const assignedUpdate = c.complaintUpdates
      .map((update) => parseAssignmentText(update.content))
      .find((value): value is string => Boolean(value));

    return {
      complaintId: c.id,
      ticketId: ticketId(c.id, c.createdAt),
      statusCode: c.status,
      status: statusLabel(c.status),
      severity: categoryLabel(c.priority),
      submitted: c.createdAt.toISOString(),
      daysPending: Number(pendingDays.toFixed(1)),
      student: c.isAnonymous ? "Anonymous" : c.studentProfile?.user.name ?? "Unknown",
      category: categoryLabel(c.category),
      assignedTo: assignedUpdate ?? "Unassigned",
      ageBand,
    };
  });

  return (
    <main className="min-h-screen p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="surface-hero p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-semibold text-slate-900">Complaint Queue</p>
              <p className="text-sm text-slate-600">Hostel: {hostel.name}</p>
              <p className="text-xs text-slate-500">
                Color code: Green (0-14 days), Yellow (15-30 days), Red (over 30 days)
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/warden/dashboard" className="nav-pill px-3 py-2">
                Back to Dashboard
              </Link>
              <Link href="/warden/reports" className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm text-white shadow-md shadow-sky-200">
                Generate Report
              </Link>
            </div>
          </div>
        </header>

        <ComplaintQueueTable items={items} />
      </div>
    </main>
  );
}
