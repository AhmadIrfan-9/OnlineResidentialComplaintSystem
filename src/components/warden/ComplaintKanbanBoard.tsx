"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  ImageIcon,
  ShieldCheck,
  UserCircle2,
  ExternalLink,
  Clock,
  AlertTriangle,
  Tag,
  ListChecks,
  Loader2,
} from "lucide-react";
import { updateComplaintStatus, addComplaintComment } from "@/actions/complaints";
import type { QueueItem } from "@/components/warden/ComplaintQueueTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER: QueueItem["statusCode"][] = ["PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const STATUS_META: Record<
  QueueItem["statusCode"],
  { label: string; dot: string; badge: string; col: string; header: string }
> = {
  PENDING:     { label: "Pending",     dot: "bg-red-500",     badge: "bg-red-100 text-red-800",      col: "border-t-4 border-t-red-500",     header: "bg-red-50 border-red-100 text-red-900" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-800",  col: "border-t-4 border-t-amber-500",   header: "bg-amber-50 border-amber-100 text-amber-900" },
  RESOLVED:    { label: "Resolved",    dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800", col: "border-t-4 border-t-emerald-500", header: "bg-emerald-50 border-emerald-100 text-emerald-900" },
  CLOSED:      { label: "Closed",      dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-700",  col: "border-t-4 border-t-slate-400",   header: "bg-slate-50 border-slate-200 text-slate-800" },
};

const PRIORITY_BORDER: Record<QueueItem["priority"], string> = {
  EMERGENCY: "border-l-4 border-l-red-500",
  URGENT:    "border-l-4 border-l-amber-400",
  ROUTINE:   "border-l-4 border-l-blue-300",
};

const PRIORITY_BADGE: Record<QueueItem["priority"], string> = {
  EMERGENCY: "bg-red-100 text-red-700 border border-red-200",
  URGENT:    "bg-amber-100 text-amber-700 border border-amber-200",
  ROUTINE:   "bg-slate-100 text-slate-600",
};

const VALID_NEXT: Record<QueueItem["statusCode"], QueueItem["statusCode"][]> = {
  PENDING:     ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED", "PENDING"],
  RESOLVED:    ["CLOSED"],
  CLOSED:      [],
};

const STATUS_BTN: Record<QueueItem["statusCode"], { active: string; inactive: string }> = {
  PENDING:     { active: "bg-red-600 text-white",     inactive: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100" },
  IN_PROGRESS: { active: "bg-amber-500 text-white",   inactive: "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100" },
  RESOLVED:    { active: "bg-emerald-600 text-white", inactive: "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100" },
  CLOSED:      { active: "bg-slate-600 text-white",   inactive: "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const isImageEvidence = (fileType: string, url: string): boolean => {
  if (fileType.startsWith("image/")) return true;
  const lower = url.toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((ext) => lower.includes(ext));
};

const initBoardState = (items: QueueItem[]) => {
  const cardsById: Record<string, QueueItem> = {};
  const columns = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, [] as string[]])
  ) as Record<QueueItem["statusCode"], string[]>;
  for (const item of items) {
    cardsById[item.complaintId] = item;
    columns[item.statusCode].push(item.complaintId);
  }
  for (const s of STATUS_ORDER) {
    columns[s].sort((a, b) => cardsById[b].daysPending - cardsById[a].daysPending);
  }
  return { cardsById, columns };
};

// ── Evidence thumbnail ────────────────────────────────────────────────────────

const EvidenceThumb = memo(function EvidenceThumb({ item }: { item: QueueItem }) {
  const first = item.evidences[0];
  if (!first) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
        No evidence
      </div>
    );
  }
  const isImg = isImageEvidence(first.fileType, first.fileUrl);
  return (
    <a
      href={first.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-lg border border-slate-200"
      onClick={(e) => e.stopPropagation()}
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={first.fileUrl} alt="Evidence" className="h-20 w-full object-cover" />
      ) : (
        <div className="flex h-20 items-center justify-center bg-slate-50 text-slate-500">
          <FileText className="h-5 w-5" />
        </div>
      )}
    </a>
  );
});

// ── Kanban Card ───────────────────────────────────────────────────────────────

const KanbanCard = memo(function KanbanCard({
  item,
  disabled,
  onStatusChange,
  onCardClick,
  onDragStart,
  selectable,
  isSelected,
  onSelect,
}: {
  item: QueueItem;
  disabled: boolean;
  onStatusChange: (id: string, next: QueueItem["statusCode"]) => void;
  onCardClick: (item: QueueItem) => void;
  onDragStart: (id: string) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const meta = STATUS_META[item.statusCode];
  const priCls = PRIORITY_BORDER[item.priority];
  const priBadge = PRIORITY_BADGE[item.priority];

  return (
    <article
      draggable={!selectable}
      onDragStart={() => !selectable && onDragStart(item.complaintId)}
      onClick={() => !selectable && onCardClick(item)}
      className={`group relative cursor-pointer rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${priCls} ${isSelected ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}
    >
      {selectable && (
        <div
          className="absolute top-3 right-3 z-10"
          onClick={(e) => { e.stopPropagation(); onSelect?.(item.complaintId); }}
        >
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={() => {}}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
          />
        </div>
      )}
      {/* Card Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{item.title}</p>
          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] font-mono text-slate-400">{item.ticketId}</p>
      </div>

      {/* Evidence */}
      <div className="px-4 pt-3">
        <EvidenceThumb item={item} />
      </div>

      {/* Meta info */}
      <div className="px-4 pt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${priBadge}`}>
            {item.priority === "EMERGENCY" && <AlertTriangle className="h-2.5 w-2.5" />}
            {item.priority}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            <Clock className="h-2.5 w-2.5" />
            {item.daysPending}d
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            <Tag className="h-2.5 w-2.5" />
            {item.category}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
            <UserCircle2 className="h-2.5 w-2.5" /> {item.student}
          </span>
          {item.statusCode !== "PENDING" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[10px] text-purple-700">
              <UserCircle2 className="h-2.5 w-2.5" /> {item.management}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 mt-2 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 outline-none"
          value={item.statusCode}
          disabled={disabled}
          onChange={(e) => onStatusChange(item.complaintId, e.target.value as QueueItem["statusCode"])}
        >
          {STATUS_ORDER.map((opt) => (
            <option key={opt} value={opt}>{STATUS_META[opt].label}</option>
          ))}
        </select>
        <button
          className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); onCardClick(item); }}
        >
          <ExternalLink className="h-3 w-3" /> View
        </button>
      </div>
    </article>
  );
});

// ── Empty column placeholder ──────────────────────────────────────────────────

function EmptyColumn({ status }: { status: QueueItem["statusCode"] }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-slate-400">
      <CheckCircle2 className="mb-2 h-8 w-8 opacity-30" />
      <p className="text-sm font-medium">No {STATUS_META[status].label} complaints</p>
    </div>
  );
}

// ── Main Board ────────────────────────────────────────────────────────────────

export function ComplaintKanbanBoard({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [cardsById, setCardsById] = useState(() => initBoardState(items).cardsById);
  const [columnCardIds, setColumnCardIds] = useState(() => initBoardState(items).columns);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<QueueItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<QueueItem["statusCode"] | null>("PENDING");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  const handleFilterClick = (s: QueueItem["statusCode"]) => {
    setActiveFilter(prev => prev === s ? null : s);
    setSelectedIds(new Set());
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => prev.size === ids.length ? new Set() : new Set(ids));
  }, []);

  const handleBulkStatusChange = useCallback(async (nextStatus: QueueItem["statusCode"]) => {
    if (selectedIds.size === 0 || bulkPending) return;
    setBulkPending(true);
    await Promise.all([...selectedIds].map(id => updateComplaintStatus(id, nextStatus)));
    setBulkPending(false);
    setSelectedIds(new Set());
    router.refresh();
  }, [selectedIds, bulkPending, router]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        STATUS_ORDER.map((s) => [s, columnCardIds[s].map((id) => cardsById[id]).filter(Boolean)])
      ) as Record<QueueItem["statusCode"], QueueItem[]>,
    [cardsById, columnCardIds]
  );

  const counts = useMemo(
    () => Object.fromEntries(STATUS_ORDER.map((s) => [s, grouped[s].length])) as Record<QueueItem["statusCode"], number>,
    [grouped]
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleStatusChange = useCallback(
    async (complaintId: string, nextStatus: QueueItem["statusCode"]) => {
      const current = cardsById[complaintId];
      if (!current || current.statusCode === nextStatus) return;
      const prev = current.statusCode;
      setUpdatingId(complaintId);
      setCardsById((p) => ({ ...p, [complaintId]: { ...p[complaintId], statusCode: nextStatus, status: STATUS_META[nextStatus].label } }));
      setColumnCardIds((p) => ({
        ...p,
        [prev]: p[prev].filter((id) => id !== complaintId),
        [nextStatus]: [complaintId, ...p[nextStatus].filter((id) => id !== complaintId)],
      }));
      const result = await updateComplaintStatus(complaintId, nextStatus);
      if (!result.success) {
        setCardsById((p) => ({ ...p, [complaintId]: { ...p[complaintId], statusCode: prev, status: STATUS_META[prev].label } }));
        setColumnCardIds((p) => ({
          ...p,
          [nextStatus]: p[nextStatus].filter((id) => id !== complaintId),
          [prev]: [complaintId, ...p[prev].filter((id) => id !== complaintId)],
        }));
        window.alert(result.error ?? "Failed to update");
      }
      setUpdatingId(null);
      router.refresh();
    },
    [cardsById, router]
  );

  const handleDrop = useCallback(
    async (targetStatus: QueueItem["statusCode"]) => {
      if (!draggingId) return;
      await handleStatusChange(draggingId, targetStatus);
      setDraggingId(null);
    },
    [draggingId, handleStatusChange]
  );

  // Cards to show in filtered grid view
  const filteredCards = useMemo(
    () => (activeFilter === null ? [] : grouped[activeFilter] ?? []),
    [activeFilter, grouped]
  );

  return (
    <>
      {/* ── Status filter tab bar ──────────────────────────────────────── */}
      <div className="surface-card px-4 py-3 mx-4 md:mx-6">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((s) => {
            const isActive = activeFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleFilterClick(s)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all ${
                  isActive ? STATUS_BTN[s].active : STATUS_BTN[s].inactive
                }`}
              >
                {STATUS_META[s].label}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${isActive ? "bg-white/25 text-white" : "bg-white/80 text-slate-600"}`}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filtered grid view OR full kanban ─────────────────────────── */}
      {activeFilter !== null ? (
        <div className="px-4 md:px-6 pb-6">
          {/* Column header banner */}
          <div className={`rounded-xl border px-5 py-3 mb-3 flex items-center justify-between ${STATUS_META[activeFilter].header}`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${STATUS_META[activeFilter].dot}`} />
              <span className="text-sm font-bold">{STATUS_META[activeFilter].label} Complaints</span>
            </div>
            <div className="flex items-center gap-3">
              {filteredCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleSelectAll(filteredCards.map(c => c.complaintId))}
                  className="flex items-center gap-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  {selectedIds.size === filteredCards.length ? "Deselect All" : "Select All"}
                </button>
              )}
              <span className="text-xs font-bold opacity-70">{filteredCards.length} ticket{filteredCards.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 mb-4">
              <ListChecks className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-blue-800">
                {selectedIds.size} complaint{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex flex-wrap gap-2 ml-auto items-center">
                {VALID_NEXT[activeFilter].map(nextStatus => (
                  <button
                    key={nextStatus}
                    type="button"
                    disabled={bulkPending}
                    onClick={() => handleBulkStatusChange(nextStatus)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${STATUS_BTN[nextStatus].inactive}`}
                  >
                    {bulkPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {bulkPending ? "Updating…" : `Move to ${STATUS_META[nextStatus].label}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <EmptyColumn status={activeFilter} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCards.map((item) => (
                <KanbanCard
                  key={item.complaintId}
                  item={item}
                  disabled={updatingId === item.complaintId}
                  onStatusChange={handleStatusChange}
                  onCardClick={setSelectedCard}
                  onDragStart={setDraggingId}
                  selectable
                  isSelected={selectedIds.has(item.complaintId)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4 px-4 md:px-6 pb-6">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            return (
              <section
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void handleDrop(status)}
                className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden"
              >
                {/* Column header */}
                <div className={`flex items-center justify-between border-b px-4 py-3 ${meta.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    <h3 className="text-sm font-bold">{meta.label}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFilterClick(status)}
                    className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-black text-slate-700 hover:bg-white shadow-sm transition-colors"
                  >
                    {grouped[status].length}
                  </button>
                </div>

                {/* Cards */}
                <div className="space-y-3 p-3">
                  {grouped[status].length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      Drop complaint here
                    </div>
                  ) : (
                    grouped[status].map((item) => (
                      <KanbanCard
                        key={item.complaintId}
                        item={item}
                        disabled={updatingId === item.complaintId}
                        onStatusChange={handleStatusChange}
                        onCardClick={setSelectedCard}
                        onDragStart={setDraggingId}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Detail modal dialog ────────────────────────────────────────── */}
      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="w-[70vw] max-w-[70vw] sm:max-w-[70vw] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {selectedCard && (
            <>
              {/* ── Hero header ── */}
              <div className="surface-hero px-7 py-6">
                <div className="flex items-start justify-between gap-6">
                  {/* Left: title + ticket + badges */}
                  <div className="min-w-0">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black text-white leading-tight pr-2">
                        {selectedCard.title}
                      </DialogTitle>
                      <DialogDescription className="font-mono text-xs text-blue-200 mt-1">
                        {selectedCard.ticketId}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`status-badge ${STATUS_META[selectedCard.statusCode].badge}`}>
                        {STATUS_META[selectedCard.statusCode].label}
                      </span>
                      <span className={`status-badge ${PRIORITY_BADGE[selectedCard.priority]}`}>
                        {selectedCard.priority}
                      </span>
                      <span className="status-badge bg-white/20 text-white">
                        <Clock className="h-3 w-3" /> {selectedCard.daysPending}d pending
                      </span>
                      <span className="status-badge bg-white/15 text-blue-100">
                        <Tag className="h-3 w-3" /> {selectedCard.category}
                      </span>
                    </div>
                  </div>

                  {/* Right: Participants (no label) — pr-10 clears the close button */}
                  <div className="shrink-0 text-right pr-10">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white">
                        <UserCircle2 className="h-3.5 w-3.5 text-blue-200" /> {selectedCard.student}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Two-column + full-width body ── */}
              <div className="bg-slate-50 p-6 grid grid-cols-1 md:grid-cols-[1fr_1.6fr] gap-5 max-h-[78vh] overflow-y-auto">

                {/* LEFT column */}
                <div className="space-y-4">

                  {/* Complaint details */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Complaint Details</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Category</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedCard.category}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Priority</p>
                        <p className={`text-sm font-bold mt-0.5 ${selectedCard.priority === "EMERGENCY" ? "text-red-600" : selectedCard.priority === "URGENT" ? "text-amber-600" : "text-slate-700"}`}>
                          {selectedCard.priority}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Submitted</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5 whitespace-nowrap">
                          {new Date(selectedCard.submitted).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Days Pending</p>
                        <p className={`text-sm font-bold mt-0.5 whitespace-nowrap ${selectedCard.daysPending > 7 ? "text-red-600" : selectedCard.daysPending > 2 ? "text-amber-600" : "text-emerald-600"}`}>
                          {selectedCard.daysPending} days
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Assigned To</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{selectedCard.assignedTo}</p>
                      </div>
                    </div>
                  </div>

                  {/* Message history — below complaint details */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        Message History ({selectedCard.messageHistory.length})
                      </p>
                    </div>
                    <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
                      {selectedCard.messageHistory.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">No messages recorded.</p>
                      ) : (
                        selectedCard.messageHistory.map((entry, i) => (
                          <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] text-slate-400 mb-1">{new Date(entry.createdAt).toLocaleString()}</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{entry.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    {/* Add reply input */}
                    <form
                      className="border-t border-slate-100 p-3 bg-slate-50/50 flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const msg = replyText.trim();
                        if (!msg) return;
                        setIsReplying(true);
                        try {
                          await addComplaintComment(selectedCard.complaintId, msg);
                          setReplyText("");
                          router.refresh();
                        } finally {
                          setIsReplying(false);
                        }
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Add a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        disabled={isReplying}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        disabled={isReplying || !replyText.trim()}
                        className="shrink-0 flex items-center justify-center rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px]"
                      >
                        {isReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reply"}
                      </button>
                    </form>
                  </div>
                </div>

                {/* RIGHT column — Evidence */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden h-fit">
                  <div className="bg-slate-50 border-b border-slate-100 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Evidence ({selectedCard.evidences.length})
                    </p>
                  </div>
                  <div className="p-4">
                    {selectedCard.evidences.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                        <ImageIcon className="h-10 w-10 mb-2" />
                        <p className="text-xs font-semibold">No evidence uploaded</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 grid-cols-1">
                        {selectedCard.evidences.map((ev) => {
                          const isImg = isImageEvidence(ev.fileType, ev.fileUrl);
                          return (
                            <a
                              key={ev.id}
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-slate-200 overflow-hidden block hover:border-blue-300 hover:shadow-md transition-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ev.fileUrl} alt="Evidence" className="w-full object-contain min-h-[300px] max-h-[560px] bg-slate-900" />
                              ) : (
                                <div className="flex h-48 items-center justify-center bg-slate-50 gap-3">
                                  <FileText className="h-10 w-10 text-slate-300" />
                                  <span className="text-sm text-slate-400 font-medium">Document file</span>
                                </div>
                              )}
                              <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-100 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                                {ev.virusScanStatus ?? "Unknown"}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
