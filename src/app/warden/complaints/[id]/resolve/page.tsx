import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
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

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
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
        <div className="surface-hero px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Management Portal</p>
            <h1 className="text-xl font-black text-white">Resolution Form</h1>
            <p className="text-sm text-blue-200 mt-0.5 font-mono">{ticketId(id, complaint.createdAt)}</p>
          </div>
          <Link
            href={`/warden/complaints/${id}`}
            className="rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            ← Back to Detail
          </Link>
        </div>
        <ResolutionFormClient complaintId={id} ticketId={ticketId(id, complaint.createdAt)} />
      </div>
    </main>
  );
}
