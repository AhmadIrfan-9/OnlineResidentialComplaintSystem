import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { type QueueItem } from "@/components/warden/ComplaintQueueTable";
import { ComplaintKanbanBoard } from "@/components/warden/ComplaintKanbanBoard";
import { parseAssignmentText, toAgeBand, toPendingDays } from "@/lib/complaints";
import { resolveEvidenceListUrls } from "@/lib/storage/evidence";
import { storageService } from "@/lib/storage/StorageService";

const categoryLabel = (value: string): string => {
  if (value.toUpperCase() === "OTHER") return "Others";
  return value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
};

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

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedHostels =
    assignedHostels.length > 0
      ? assignedHostels
      : await db.hostel.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  if (scopedHostels.length === 0) {
    return (
      <main className="min-h-screen p-3 md:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No hostel is configured yet. Please create at least one hostel in admin settings.
          </div>
        </div>
      </main>
    );
  }

  const scopeLabel =
    scopedHostels.length === 1 ? scopedHostels[0].name : `${scopedHostels.length} hostels`;

  const complaints = await db.complaint.findMany({
    where: { hostelId: { in: scopedHostels.map((item) => item.id) } },
    include: {
      hostel: {
        include: {
          warden: {
            select: { name: true },
          },
        },
      },
      studentProfile: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      evidences: {
        select: {
          id: true,
          fileUrl: true,
          fileType: true,
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
  const items: QueueItem[] = await Promise.all(
    complaints.map(async (c) => {
      const pendingDays = toPendingDays(c.createdAt, now);
      const ageBand = toAgeBand(pendingDays);
      const assignedUpdate = c.complaintUpdates
        .map((update) => parseAssignmentText(update.content))
        .find((value): value is string => Boolean(value));

      const resolvedEvidence = await resolveEvidenceListUrls(c.evidences);
      const evidencesWithMetadata = await Promise.all(
        resolvedEvidence.map(async (evidence) => {
          const parsed = storageService.parseObjectKey(evidence.fileUrl);
          if (!parsed) {
            return {
              ...evidence,
              uploadDate: null,
              uploaderId: null,
              virusScanStatus: null,
            };
          }

          try {
            const objectMeta = await storageService.getObjectMetadata(
              parsed.complaintId,
              parsed.fileUuid,
              parsed.extension
            );
            const metadataAny = objectMeta.metadata as any;
            return {
              ...evidence,
              uploadDate: metadataAny.upload_date ?? objectMeta.lastModified,
              uploaderId: metadataAny.uploader_id ?? null,
              virusScanStatus: metadataAny.virus_scan_status ?? null,
            };
          } catch {
            return {
              ...evidence,
              uploadDate: null,
              uploaderId: null,
              virusScanStatus: null,
            };
          }
        })
      );

      return {
        complaintId: c.id,
        title: c.title,
        ticketId: ticketId(c.id, c.createdAt),
        statusCode: c.status,
        status: statusLabel(c.status),
        submitted: c.createdAt.toISOString(),
        daysPending: Number(pendingDays.toFixed(1)),
        student: c.isAnonymous ? "Anonymous" : c.studentProfile?.user.name ?? "Unknown",
        management: assignedUpdate ?? c.hostel.warden.name ?? "Management",
        category: categoryLabel(c.category),
        assignedTo: assignedUpdate ?? "Unassigned",
        priority: c.priority,
        ageBand,
        evidences: evidencesWithMetadata,
        messageHistory: c.complaintUpdates.map((update) => ({
          content: update.content,
          createdAt: update.createdAt.toISOString(),
        })),
      };
    })
  );

  return (
    <div className="space-y-6">
      {/* Blue/red themed page banner */}
      <div className="surface-hero px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">
              Management Portal
            </p>
            <h1 className="text-2xl font-black text-white">Complaint Queue</h1>
            <p className="text-sm text-blue-200 mt-0.5">Residency: {scopeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <div className="flex flex-col items-start rounded-lg bg-white/15 px-3 py-2">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-bold">0–2 days</span>
                <span className="ml-1 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">On Track</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/50">Complaint is within safe response window.</p>
            </div>
            <div className="flex flex-col items-start rounded-lg bg-white/15 px-3 py-2">
              <div className="flex items-center gap-1.5 text-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="font-bold">3–7 days</span>
                <span className="ml-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-200">Warning</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/50">Needs attention — response overdue soon.</p>
            </div>
            <div className="flex flex-col items-start rounded-lg bg-white/15 px-3 py-2">
              <div className="flex items-center gap-1.5 text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="font-bold">8+ days</span>
                <span className="ml-1 rounded-full bg-red-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-200">Critical</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/50">SLA breached — immediate action required.</p>
            </div>
          </div>
        </div>
      </div>

      <ComplaintKanbanBoard items={items} />
    </div>
  );
}
