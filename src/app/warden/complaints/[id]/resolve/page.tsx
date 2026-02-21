import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { ResolutionFormClient } from "@/components/warden/ResolutionFormClient";

const ticketId = (id: string, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = `${createdAt.getMonth() + 1}`.padStart(2, "0");
  const d = `${createdAt.getDate()}`.padStart(2, "0");
  return `ORCS-${y}${m}${d}-${id.slice(0, 4).toUpperCase()}`;
};

export default async function ResolveComplaintPage({
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
      hostel: { select: { wardenId: true } },
    },
  });

  if (!complaint) {
    notFound();
  }

  if (role === "MANAGEMENT" && complaint.hostel.wardenId !== session.user.id) {
    redirect("/warden/queue");
  }

  return (
    <main className="min-h-screen p-3 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="surface-hero p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Resolution Form</h1>
            <Link href={`/warden/complaints/${id}`} className="nav-pill px-3 py-1.5 text-sm">
              Back to Detail
            </Link>
          </div>
        </div>
        <ResolutionFormClient complaintId={id} ticketId={ticketId(id, complaint.createdAt)} />
      </div>
    </main>
  );
}
