"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  addComplaintComment,
  assignComplaint,
  updateComplaintCategory,
  updateComplaintStatus,
} from "@/actions/complaints";
import { normalizeRoleKey } from "@/lib/roles";
import { AiInsightSidebar } from "@/components/warden/AiInsightSidebar";
import {
  User,
  Building2,
  Tag,
  MessageSquare,
  FileImage,
  ShieldAlert,
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  StickyNote,
  Zap,
  Printer,
  Sparkles,
  EyeOff,
} from "lucide-react";

interface DetailData {
  id: string;
  ticketId: string;
  studentName: string;
  studentIdentifier: string;
  hostelName: string;
  contact: string;
  submissionMode: "Identified" | "Anonymous";
  submittedAt: string;
  categoryCode: string;
  categoryOptions: string[];
  category: string;
  status: string;
  daysPending: number;
  ageBand: "GREEN" | "YELLOW" | "RED";
  assignedTo: string;
  assigneeOptions: string[];
  updatedAt: string;
  description: string;
  isAnonymous: boolean;
  satisfactionRating: number | null;
  evidence: Array<{ id: string; fileUrl: string; fileType: string }>;
  updates: Array<{ id: string; createdAt: string; content: string; role: string; name: string }>;
}

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const pretty = (value: string): string =>
  value.toLowerCase().split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

const ageBandConfig = {
  RED: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", label: "Overdue" },
  YELLOW: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", label: "Aging" },
  GREEN: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "On Track" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: "bg-blue-100",    text: "text-blue-800"    },
  IN_PROGRESS: { bg: "bg-amber-100",   text: "text-amber-800"   },
  RESOLVED:    { bg: "bg-emerald-100", text: "text-emerald-800" },
  CLOSED:      { bg: "bg-slate-100",   text: "text-slate-600"   },
};

function NoiseMeterBadge({ category, block }: { category: string; block: string }) {
  const isNoise = /noise|bising|loud|sound|music|bunyi/i.test(category);
  if (!isNoise) return null;
  const blockLabel = block || "[Block]";
  const en = `Security Notice: A high noise level has been detected in your vicinity (Block ${blockLabel}). Please keep volume levels low to maintain a conducive environment. Repeated violations may result in a fine according to the Student Handbook.`;
  const ms = `Notis Keselamatan: Tahap bunyi bising yang tinggi telah dikesan di kawasan anda (Blok ${blockLabel}). Sila pastikan tahap bunyi rendah bagi menjaga ketenteraman bersama. Pelanggaran berulang boleh mengakibatkan denda mengikut Buku Panduan Pelajar.`;
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-3">
        <ShieldAlert className="h-4 w-4 text-red-600" />
        <span className="text-sm font-bold text-red-800">Acoustically Verified Noise Complaint</span>
        <span className="ml-auto rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">&gt; 60 dB</span>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600">English</p>
          <p className="text-xs leading-relaxed text-slate-700 bg-blue-50 rounded-lg p-3 border border-blue-100">{en}</p>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-red-600">Bahasa Melayu</p>
          <p className="text-xs leading-relaxed text-slate-700 bg-red-50 rounded-lg p-3 border border-red-100">{ms}</p>
        </div>
      </div>
    </div>
  );
}

export function ManagementComplaintDetailClient({ detail }: { detail: DetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(detail.status);
  const [category, setCategory] = useState(detail.categoryCode);
  const [assignedTo, setAssignedTo] = useState(detail.assignedTo);
  const [proposedStatus, setProposedStatus] = useState(NEXT_STATUS[detail.status]?.[0] ?? "");
  const [responseMessage, setResponseMessage] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [internalNoteOpen, setInternalNoteOpen] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [escalating, setEscalating] = useState(false);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const applyStatusChange = (targetStatus: string, message?: string) => {
    startTransition(async () => {
      const closureNote = targetStatus === "CLOSED" ? message : undefined;
      const statusRes = await updateComplaintStatus(detail.id, targetStatus, closureNote);
      if (!statusRes.success) { showFeedback(statusRes.error ?? "Failed to update status", "error"); return; }
      // Only add a separate comment if NOT CLOSED (closure note already recorded as ComplaintUpdate)
      if (targetStatus !== "CLOSED" && message && message.trim().length > 0) {
        await addComplaintComment(detail.id, message.trim());
      }
      showFeedback(`Status updated to ${pretty(targetStatus)}`);
      router.refresh();
    });
  };

  const sendMessage = () => {
    if (newMessage.trim().length === 0) { showFeedback("Message cannot be empty", "error"); return; }
    startTransition(async () => {
      const result = await addComplaintComment(detail.id, newMessage);
      if (!result.success) { showFeedback(result.error ?? "Failed to send message", "error"); return; }
      setNewMessage("");
      showFeedback("Message sent");
      router.refresh();
    });
  };

  const saveAssignment = () => {
    startTransition(async () => {
      const result = await assignComplaint(detail.id, assignedTo);
      if (!result.success) { showFeedback(result.error ?? "Failed to save assignment", "error"); return; }
      showFeedback(`Assigned to ${result.data?.assignedTo ?? assignedTo}`);
      router.refresh();
    });
  };

  const saveCategory = () => {
    startTransition(async () => {
      const result = await updateComplaintCategory(detail.id, category);
      if (!result.success) { showFeedback(result.error ?? "Failed to update category", "error"); return; }
      showFeedback("Category updated.");
      router.refresh();
    });
  };

  const submitInternalNote = () => {
    if (internalNote.trim().length < 3) { showFeedback("Internal note must be at least 3 characters.", "error"); return; }
    startTransition(async () => {
      const result = await addComplaintComment(detail.id, `[Internal Note] ${internalNote.trim()}`);
      if (!result.success) { showFeedback(result.error ?? "Failed to add note", "error"); return; }
      setInternalNote(""); setInternalNoteOpen(false);
      showFeedback("Internal note added.");
      router.refresh();
    });
  };

  const submitEscalation = () => {
    setEscalating(true);
    startTransition(async () => {
      const result = await addComplaintComment(
        detail.id,
        `[ESCALATED] This complaint has been escalated for urgent management review. Ticket: ${detail.ticketId}.`
      );
      if (!result.success) { showFeedback(result.error ?? "Failed to escalate", "error"); }
      else showFeedback("Complaint escalated. Audit trail updated.");
      setEscalating(false);
      router.refresh();
    });
  };

  const ageCfg = ageBandConfig[detail.ageBand];
  const stCfg = statusConfig[detail.status] ?? { bg: "bg-slate-100", text: "text-slate-600" };

  return (
    <>
      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="surface-hero px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/warden/queue"
              className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-200 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Queue
            </Link>
            <h1 className="text-xl font-black text-white">Complaint Detail</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm text-blue-200 font-mono">{detail.ticketId}</span>
              <span className={`status-badge ${stCfg.bg} ${stCfg.text}`}>{pretty(detail.status)}</span>
              <span className={`status-badge ${ageCfg.bg} ${ageCfg.text}`}>
                {detail.daysPending.toFixed(1)}d · {ageCfg.label}
              </span>
            </div>
          </div>
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              aiOpen
                ? "bg-white/20 text-white ring-2 ring-white/30"
                : "bg-white/15 hover:bg-white/25 text-white"
            }`}
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            {aiOpen ? "Hide AI Analysis" : "AI Analysis"}
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-black tracking-wider">RAG</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Top info grid ───────────────────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-2">

          {/* Student info */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-5 py-3">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-blue-900">Student Information</h2>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              {detail.isAnonymous && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  Student identity is hidden — submitted anonymously.
                </div>
              )}
              {[
                { label: "Student Name",     value: detail.studentName },
                { label: "Student/Staff ID", value: detail.studentIdentifier },
                { label: "Hostel",           value: detail.hostelName },
                { label: "Contact",          value: detail.contact },
                { label: "Submitted",        value: new Date(detail.submittedAt).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-wrap items-baseline gap-1">
                  <span className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                  <span className="text-slate-800 font-medium">{value}</span>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</span>
                <span className={`status-badge ${detail.isAnonymous ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-800"}`}>
                  {detail.submissionMode}
                </span>
              </div>
            </div>
          </div>

          {/* Complaint controls */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <Tag className="h-4 w-4 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-800">Complaint Controls</h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Category</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {detail.categoryOptions.map((o) => (
                      <option key={o} value={o}>{pretty(o)}</option>
                    ))}
                  </select>
                  <button className="btn-primary px-4 py-2 text-xs" onClick={saveCategory} disabled={isPending}>
                    Save
                  </button>
                </div>
              </div>

              {/* Assignment */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Assigned To</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  >
                    {detail.assigneeOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <button className="btn-primary px-4 py-2 text-xs" onClick={saveAssignment} disabled={isPending}>
                    Assign
                  </button>
                </div>
              </div>

              {/* Last updated */}
              <p className="text-xs text-slate-400">
                Last updated: {new Date(detail.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ── Description ──────────────────────────────────────────────── */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <Building2 className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Complaint Description</h3>
          </div>
          <p className="whitespace-pre-wrap p-5 text-sm leading-relaxed text-slate-700">{detail.description}</p>
        </div>

        {/* ── Evidence ─────────────────────────────────────────────────── */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <FileImage className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Evidence Files</h3>
            <span className="ml-auto text-xs text-slate-400">{detail.evidence.length} file(s)</span>
          </div>
          <div className="p-5">
            {detail.evidence.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No evidence attached.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {detail.evidence.map((file) => (
                  <div key={file.id} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                    {file.fileType.startsWith("image/") ? (
                      <div className="relative h-36 w-full">
                        <Image src={file.fileUrl} alt="Evidence" fill className="object-cover" />
                      </div>
                    ) : (
                      <a
                        href={file.fileUrl}
                        className="flex items-center justify-center h-36 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download Video
                      </a>
                    )}
                    <div className="px-3 py-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500">
                        {new Date(detail.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Noise meter */}
        <NoiseMeterBadge
          category={detail.category}
          block={detail.hostelName.split(" ")[0] ?? detail.hostelName}
        />

        {/* ── Status change ─────────────────────────────────────────────── */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <CheckCircle2 className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Update Status</h3>
            <span className={`ml-auto status-badge ${stCfg.bg} ${stCfg.text}`}>
              Current: {pretty(detail.status)}
            </span>
          </div>
          <div className="p-5">
            {(NEXT_STATUS[detail.status] ?? []).length === 0 ? (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500 text-center">
                This complaint is <span className="font-semibold">{pretty(detail.status)}</span> — no further status transitions available.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Proposed Status
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    value={proposedStatus}
                    onChange={(e) => setProposedStatus(e.target.value)}
                  >
                    {(NEXT_STATUS[detail.status] ?? []).map((s) => (
                      <option key={s} value={s}>{pretty(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {proposedStatus === "CLOSED" ? "Closure Reason" : "Response Note"}{" "}
                    <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal normal-case text-slate-400">(min 10 chars)</span>
                  </label>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    placeholder={proposedStatus === "CLOSED" ? "State the reason for closing this complaint…" : "Describe the action taken…"}
                  />
                </div>
              </div>
            )}
            {(NEXT_STATUS[detail.status] ?? []).length > 0 && (
              <button
                className="btn-primary mt-4"
                disabled={isPending || proposedStatus.length === 0 || responseMessage.trim().length < 10}
                onClick={() => applyStatusChange(proposedStatus, responseMessage)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {isPending ? "Submitting…" : "Submit Status Change"}
              </button>
            )}
          </div>
        </div>

        {/* ── Student Satisfaction Rating ──────────────────────────────── */}
        {detail.satisfactionRating !== null && (
          <div className="surface-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-base leading-none">⭐</span>
              <h3 className="text-sm font-bold text-slate-800">Student Satisfaction</h3>
            </div>
            <div className="flex items-center gap-4 p-5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className={`text-2xl leading-none ${star <= (detail.satisfactionRating ?? 0) ? "text-amber-400" : "text-slate-200"}`}>
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {detail.satisfactionRating}/5 — {
                  detail.satisfactionRating >= 5 ? "Excellent" :
                  detail.satisfactionRating >= 4 ? "Good" :
                  detail.satisfactionRating >= 3 ? "Average" :
                  detail.satisfactionRating >= 2 ? "Poor" : "Very Poor"
                }
              </span>
            </div>
          </div>
        )}

        {/* ── Messages ─────────────────────────────────────────────────── */}
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <MessageSquare className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Messages & Updates</h3>
            <span className="ml-auto text-xs text-slate-400">{detail.updates.length} entries</span>
          </div>
          <div className="p-5 space-y-3">
            {detail.updates.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No messages yet.</p>
            ) : (
              detail.updates.map((u) => {
                const isStudent = normalizeRoleKey(u.role) === "STUDENT";
                const isInternal = u.content.startsWith("[Internal Note]");
                const isEscalated = u.content.startsWith("[ESCALATED]");
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl px-4 py-3 text-sm border ${
                      isInternal
                        ? "bg-amber-50 border-amber-200"
                        : isEscalated
                        ? "bg-red-50 border-red-200"
                        : isStudent
                        ? "bg-blue-50 border-blue-100"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${
                        isInternal ? "text-amber-700" : isEscalated ? "text-red-700" : isStudent ? "text-blue-700" : "text-slate-700"
                      }`}>
                        {isInternal ? "🔒 Internal Note" : isEscalated ? "⚠️ Escalated" : isStudent ? "Student" : u.name}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{u.content}</p>
                  </div>
                );
              })
            )}

            {/* Reply box */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              {detail.isAnonymous ? (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <EyeOff className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <span className="font-semibold text-slate-700">Messaging unavailable.</span>{" "}
                    This complaint was submitted anonymously — the student&apos;s identity is hidden and replies cannot be delivered.
                  </span>
                </div>
              ) : (
                <>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Reply to Student
                  </label>
                  {/* Quick-reply templates */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      { label: "Under Review", text: "Your complaint has been received and is currently under review. We will update you as soon as possible." },
                      { label: "Technician Dispatched", text: "A technician has been assigned and will attend to this issue shortly. Please ensure access to the room is available." },
                      { label: "Resolved — Please Confirm", text: "The reported issue has been addressed. Please confirm whether the problem has been resolved to your satisfaction." },
                      { label: "Need More Details", text: "To help us address your complaint, please provide additional information or clear photos showing the issue." },
                    ].map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => setNewMessage(t.text)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message to the student…"
                  />
                  <button className="btn-primary" onClick={sendMessage} disabled={isPending}>
                    <MessageSquare className="h-4 w-4" />
                    {isPending ? "Sending…" : "Send Message"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Action bar ───────────────────────────────────────────────── */}
        <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/warden/complaints/${detail.id}/resolve`}
            className="btn-primary"
          >
            <CheckCircle2 className="h-4 w-4" />
            Open Resolution Form
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/warden/reports"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Clock className="h-4 w-4 text-slate-500" />
              Generate Report
            </Link>

            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                onClick={() => setActionsOpen((v) => !v)}
              >
                <MoreHorizontal className="h-4 w-4" /> More Actions
              </button>

              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                  <div className="absolute bottom-full right-0 z-50 mb-2 w-52 origin-bottom-right rounded-xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
                    <button
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                      disabled={escalating || isPending}
                      onClick={() => { setActionsOpen(false); submitEscalation(); }}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {escalating ? "Escalating…" : "Escalate to Management"}
                    </button>
                    <button
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                      onClick={() => { setActionsOpen(false); setInternalNoteOpen(true); }}
                    >
                      <StickyNote className="h-4 w-4" />
                      Add Internal Note
                    </button>
                    <button
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={() => { setActionsOpen(false); window.print(); }}
                    >
                      <Printer className="h-4 w-4" />
                      Print / Export PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium border ${
              feedback.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {feedback.type === "success" ? "✓" : "✕"} {feedback.text}
          </div>
        )}
      </div>

      {/* ── Internal Note Modal ──────────────────────────────────────── */}
      {internalNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <StickyNote className="h-5 w-5 text-amber-600" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Internal Note</h3>
                <p className="text-xs text-slate-400">Visible to management only</p>
              </div>
            </div>
            <textarea
              className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Enter internal note…"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => { setInternalNoteOpen(false); setInternalNote(""); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isPending || internalNote.trim().length < 3}
                onClick={submitInternalNote}
              >
                {isPending ? "Saving…" : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Drawer ────────────────────────────────────────────────── */}
      <AiInsightSidebar
        complaintId={detail.id}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onApplySuggestedAction={(action) => showFeedback(`AI Action logged: ${action}`)}
      />
    </>
  );
}
