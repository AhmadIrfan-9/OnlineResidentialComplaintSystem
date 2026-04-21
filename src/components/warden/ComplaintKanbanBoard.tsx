"use client";

import Link from "next/link";
import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, ImageIcon, ShieldCheck, UserCircle2 } from "lucide-react";
import { updateComplaintStatus } from "@/actions/complaints";
import type { QueueItem } from "@/components/warden/ComplaintQueueTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_ORDER: QueueItem["statusCode"][] = [
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const STATUS_LABEL_MAP: Record<QueueItem["statusCode"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_BADGE_STYLE: Record<QueueItem["statusCode"], string> = {
  PENDING: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-700",
};

const columnStyle = (status: QueueItem["statusCode"]): string => {
  if (status === "PENDING") return "border-amber-200 bg-amber-50/60";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50/60";
  if (status === "RESOLVED") return "border-emerald-200 bg-emerald-50/60";
  return "border-slate-200 bg-slate-50/70";
};

const isImageEvidence = (fileType: string, url: string): boolean => {
  if (fileType.startsWith("image/")) return true;
  const lowered = url.toLowerCase();
  return (
    lowered.includes(".png") ||
    lowered.includes(".jpg") ||
    lowered.includes(".jpeg") ||
    lowered.includes(".webp") ||
    lowered.includes(".gif")
  );
};

const initBoardState = (items: QueueItem[]) => {
  const cardsById: Record<string, QueueItem> = {};
  const columns = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, [] as string[]])
  ) as Record<QueueItem["statusCode"], string[]>;

  for (const item of items) {
    cardsById[item.complaintId] = item;
    columns[item.statusCode].push(item.complaintId);
  }

  for (const status of STATUS_ORDER) {
    columns[status].sort((a, b) => cardsById[b].daysPending - cardsById[a].daysPending);
  }

  return { cardsById, columns };
};

const EvidencePreview = memo(function EvidencePreview({ item }: { item: QueueItem }) {
  const first = item.evidences[0];
  if (!first) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-xs text-slate-500">
        No evidence attached
      </div>
    );
  }

  const image = isImageEvidence(first.fileType, first.fileUrl);
  return (
    <a
      href={first.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
      onClick={(event) => event.stopPropagation()}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={first.fileUrl} alt="Evidence preview" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center text-slate-600">
          <FileText className="h-6 w-6" />
        </div>
      )}
    </a>
  );
});

const KanbanCard = memo(function KanbanCard({
  item,
  disabled,
  onStatusChange,
  onCardClick,
  onDragStart,
}: {
  item: QueueItem;
  disabled: boolean;
  onStatusChange: (complaintId: string, nextStatus: QueueItem["statusCode"]) => void;
  onCardClick: (item: QueueItem) => void;
  onDragStart: (complaintId: string) => void;
}) {
  const firstEvidence = item.evidences[0];

  return (
    <article
      draggable
      onDragStart={() => onDragStart(item.complaintId)}
      onClick={() => onCardClick(item)}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="text-[11px] text-slate-500">{item.ticketId}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_BADGE_STYLE[item.statusCode]}`}>
          {STATUS_LABEL_MAP[item.statusCode]}
        </span>
      </div>

      <div className="mt-2">
        <EvidencePreview item={item} />
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
        <p>
          Upload date: {firstEvidence?.uploadDate ? new Date(firstEvidence.uploadDate).toLocaleString() : "N/A"}
        </p>
        <p>Uploader: {firstEvidence?.uploaderId ?? "N/A"}</p>
        <p className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Virus Scanned: {firstEvidence?.virusScanStatus ?? "Unknown"}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-800">
          <UserCircle2 className="h-3 w-3" />
          Student: {item.student}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-800">
          <UserCircle2 className="h-3 w-3" />
          Management: {item.management}
        </span>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Move To
        </label>
        <select
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
          value={item.statusCode}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) =>
            onStatusChange(item.complaintId, event.target.value as QueueItem["statusCode"])
          }
        >
          {STATUS_ORDER.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABEL_MAP[option]}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
});

export function ComplaintKanbanBoard({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [cardsById, setCardsById] = useState<Record<string, QueueItem>>(() => initBoardState(items).cardsById);
  const [columnCardIds, setColumnCardIds] = useState<Record<QueueItem["statusCode"], string[]>>(
    () => initBoardState(items).columns
  );
  const [updatingComplaintId, setUpdatingComplaintId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<QueueItem | null>(null);

  const handleStatusChange = useCallback(async (complaintId: string, nextStatus: QueueItem["statusCode"]) => {
    const current = cardsById[complaintId];
    if (!current || current.statusCode === nextStatus) return;
    const previousStatus = current.statusCode;
    setUpdatingComplaintId(complaintId);
    setCardsById((prev) => ({
      ...prev,
      [complaintId]: {
        ...prev[complaintId],
        statusCode: nextStatus,
        status: STATUS_LABEL_MAP[nextStatus],
      },
    }));
    setColumnCardIds((prev) => {
      const sourceIds = prev[previousStatus].filter((id) => id !== complaintId);
      const destinationIds = [complaintId, ...prev[nextStatus].filter((id) => id !== complaintId)];
      return {
        ...prev,
        [previousStatus]: sourceIds,
        [nextStatus]: destinationIds,
      };
    });

    const result = await updateComplaintStatus(complaintId, nextStatus);
    if (!result.success) {
      setCardsById((prev) => ({
        ...prev,
        [complaintId]: {
          ...prev[complaintId],
          statusCode: previousStatus,
          status: STATUS_LABEL_MAP[previousStatus],
        },
      }));
      setColumnCardIds((prev) => {
        const sourceIds = prev[nextStatus].filter((id) => id !== complaintId);
        const destinationIds = [complaintId, ...prev[previousStatus].filter((id) => id !== complaintId)];
        return {
          ...prev,
          [nextStatus]: sourceIds,
          [previousStatus]: destinationIds,
        };
      });
      window.alert(result.error ?? "Failed to update complaint status");
    }

    setUpdatingComplaintId(null);
    router.refresh();
  }, [cardsById, router]);

  const handleDropOnColumn = useCallback(async (targetStatus: QueueItem["statusCode"]) => {
    if (!draggingCardId) return;
    const dragged = cardsById[draggingCardId];
    if (!dragged || dragged.statusCode === targetStatus) {
      setDraggingCardId(null);
      return;
    }
    await handleStatusChange(draggingCardId, targetStatus);
    setDraggingCardId(null);
  }, [cardsById, draggingCardId, handleStatusChange]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        STATUS_ORDER.map((status) => [
          status,
          columnCardIds[status].map((id) => cardsById[id]).filter(Boolean),
        ])
      ) as Record<QueueItem["statusCode"], QueueItem[]>,
    [cardsById, columnCardIds]
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              void handleDropOnColumn(status);
            }}
            className={`rounded-xl border p-3 ${columnStyle(status)}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{STATUS_LABEL_MAP[status]}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                {grouped[status].length}
              </span>
            </div>

            <div className="space-y-2">
              {grouped[status].length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-4 text-center text-xs text-slate-500">
                  Drop complaint here
                </p>
              ) : (
                grouped[status].map((item) => (
                  <KanbanCard
                    key={item.complaintId}
                    item={item}
                    disabled={updatingComplaintId === item.complaintId}
                    onStatusChange={handleStatusChange}
                    onCardClick={setSelectedCard}
                    onDragStart={setDraggingCardId}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="fixed right-0 top-0 h-screen w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-slate-200 p-6 sm:max-w-2xl">
          {selectedCard && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>{selectedCard.title}</span>
                  <span className="text-sm font-normal text-slate-500">{selectedCard.ticketId}</span>
                </DialogTitle>
              </DialogHeader>

              <section className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">Participants</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">
                      <UserCircle2 className="h-3.5 w-3.5" />
                      Student: {selectedCard.student}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-800">
                      <UserCircle2 className="h-3.5 w-3.5" />
                      Management: {selectedCard.management}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Message History</p>
                  {selectedCard.messageHistory.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No messages recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {selectedCard.messageHistory.map((entry, index) => (
                        <li key={`${selectedCard.complaintId}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                          <p className="mt-1 text-sm text-slate-700">{entry.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Evidence Files</p>
                  {selectedCard.evidences.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No evidence uploaded.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedCard.evidences.map((evidence) => {
                        const image = isImageEvidence(evidence.fileType, evidence.fileUrl);
                        return (
                          <a
                            key={evidence.id}
                            href={evidence.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-slate-200 bg-slate-50 p-2"
                          >
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={evidence.fileUrl}
                                alt="Evidence"
                                className="h-28 w-full rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-28 items-center justify-center rounded bg-slate-100 text-slate-600">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                              <p>
                                Upload: {evidence.uploadDate ? new Date(evidence.uploadDate).toLocaleString() : "N/A"}
                              </p>
                              <p>Uploader: {evidence.uploaderId ?? "N/A"}</p>
                              <p className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Virus: {evidence.virusScanStatus ?? "Unknown"}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link
                    href={`/warden/complaints/${selectedCard.complaintId}`}
                    className="inline-flex rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Full Complaint
                  </Link>
                </div>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
