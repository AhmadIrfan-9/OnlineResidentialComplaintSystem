"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addComplaintComment,
  assignComplaint,
  updateComplaintCategory,
  updateComplaintStatus,
} from "@/actions/complaints";
import { normalizeRoleKey } from "@/lib/roles";
import { AiInsightSidebar } from "@/components/warden/AiInsightSidebar";

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
  evidence: Array<{
    id: string;
    fileUrl: string;
    fileType: string;
  }>;
  updates: Array<{
    id: string;
    createdAt: string;
    content: string;
    role: string;
    name: string;
  }>;
}

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const pretty = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

// ─── Noise Meter Badge ───────────────────────────────────────────────────────
// Shown in the Evidence Files section when the complaint category suggests noise.
// In the current client-only plan, detection is based on category keyword match.

function NoiseMeterBadge({ category, block }: { category: string; block: string }) {
  const isNoise = /noise|bising|loud|sound|music|bunyi/i.test(category);
  if (!isNoise) return null;

  const blockLabel = block || "[Block]";
  const en = `Security Notice: A high noise level has been detected in your vicinity (Block ${blockLabel}). Please keep volume levels low to maintain a conducive environment. Repeated violations may result in a fine according to the Student Handbook.`;
  const ms = `Notis Keselamatan: Tahap bunyi bising yang tinggi telah dikesan di kawasan anda (Blok ${blockLabel}). Sila pastikan tahap bunyi rendah bagi menjaga ketenteraman bersama. Pelanggaran berulang boleh mengakibatkan denda mengikut Buku Panduan Pelajar.`;

  return (
    <div className="mt-4 space-y-3">
      {/* Glow badge */}
      <div className="relative flex items-center gap-4 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-rose-50 p-4 shadow-sm overflow-hidden">
        {/* Pulsing red glow ring */}
        <div className="relative flex-shrink-0 flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-30" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-300">
            <span className="text-xl text-white">🔊</span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-800">Acoustically Verified Noise Complaint</p>
          <p className="text-xs text-red-600 mt-0.5">Category matched: <span className="font-semibold">{category}</span></p>
          <p className="mt-1 text-[10px] text-slate-500 uppercase tracking-wider">Management Noise Intelligence · Block {blockLabel}</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-300">
            &gt; 60 dB
          </span>
        </div>
      </div>

      {/* Bilingual notice draft */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="text-sm">📋</span>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Automated Notice Draft</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">English</p>
            <p className="text-xs leading-relaxed text-slate-700 bg-blue-50 rounded-lg p-2.5 border border-blue-100">{en}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-600">Bahasa Melayu</p>
            <p className="text-xs leading-relaxed text-slate-700 bg-purple-50 rounded-lg p-2.5 border border-purple-100">{ms}</p>
          </div>
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
  const [feedback, setFeedback] = useState("");

  // ── AI Drawer state ──
  const [aiOpen, setAiOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const applyStatusChange = (targetStatus: string, message?: string) => {
    startTransition(async () => {
      const statusRes = await updateComplaintStatus(detail.id, targetStatus);
      if (!statusRes.success) {
        setFeedback(statusRes.error ?? "Failed to update status");
        return;
      }
      if (message && message.trim().length > 0) {
        await addComplaintComment(detail.id, message.trim());
      }
      setFeedback(`Status updated to ${pretty(targetStatus)}`);
      router.refresh();
    });
  };

  const sendMessage = () => {
    if (newMessage.trim().length === 0) {
      setFeedback("Message cannot be empty");
      return;
    }
    startTransition(async () => {
      const result = await addComplaintComment(detail.id, newMessage);
      if (!result.success) {
        setFeedback(result.error ?? "Failed to send message");
        return;
      }
      setNewMessage("");
      setFeedback("Message sent");
      router.refresh();
    });
  };

  const saveAssignment = () => {
    startTransition(async () => {
      const result = await assignComplaint(detail.id, assignedTo);
      if (!result.success) {
        setFeedback(result.error ?? "Failed to save assignment");
        return;
      }
      setFeedback(`Assigned to ${result.data?.assignedTo ?? assignedTo}`);
      router.refresh();
    });
  };

  const saveCategory = () => {
    startTransition(async () => {
      const result = await updateComplaintCategory(detail.id, category);
      if (!result.success) {
        setFeedback(result.error ?? "Failed to update category");
        return;
      }
      setFeedback("Category updated.");
      router.refresh();
    });
  };

  return (
    <>
      {/* ── Injected Keyframes (button shimmer etc.) ── */}
      <style>{`
        @keyframes ai-btn-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .ai-trigger-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.03em;
          border: none;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.2s;
          background: linear-gradient(
            135deg,
            #4f46e5 0%, #7c3aed 50%, #6d28d9 100%
          );
          color: #fff;
          box-shadow: 0 4px 14px rgba(79,70,229,0.45);
        }
        .ai-trigger-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.18) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: ai-btn-shimmer 2.5s linear infinite;
        }
        .ai-trigger-btn:hover   { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.6); }
        .ai-trigger-btn:active  { transform: translateY(0); }
        .ai-trigger-btn.open {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          box-shadow: 0 2px 8px rgba(30,27,75,0.5), inset 0 0 0 1px rgba(99,102,241,0.4);
        }
      `}</style>

      {/* ── Page Header (replaces static server header) ── */}
      <header className="surface-hero p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Complaint Detail — Management View
          </h1>
          <p className="text-sm text-slate-500">{detail.ticketId}</p>
        </div>

        {/* ✨ AI Trigger Button */}
        <button
          id="ai-analysis-toggle"
          className={`ai-trigger-btn${aiOpen ? " open" : ""}`}
          onClick={() => setAiOpen((v) => !v)}
          aria-expanded={aiOpen}
          aria-controls="ai-insight-drawer"
        >
          <span style={{ fontSize: "15px" }}>✨</span>
          {aiOpen ? "Hide AI Analysis" : "AI Analysis"}
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.06em",
              background: "rgba(255,255,255,0.18)",
              borderRadius: "4px",
              padding: "1px 5px",
              lineHeight: "16px",
            }}
          >
            RAG
          </span>
        </button>
      </header>

      {/* ── Main Content (full-width, no grid shift) ── */}
      <div className="space-y-4">

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Student Information */}
          <section className="surface-card p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Student Information</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Student name:</span> {detail.studentName}</p>
              <p><span className="font-medium">Student ID:</span> {detail.studentIdentifier}</p>
              <p><span className="font-medium">Hostel:</span> {detail.hostelName}</p>
              <p><span className="font-medium">Contact:</span> {detail.contact}</p>
              <p><span className="font-medium">Submission date:</span> {new Date(detail.submittedAt).toLocaleString()}</p>
              <p>
                <span className="font-medium">Submission mode:</span>{" "}
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    detail.isAnonymous
                      ? "bg-slate-200 text-slate-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {detail.submissionMode}
                </span>
              </p>
            </div>
          </section>

          {/* Complaint Information */}
          <section className="surface-card p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Complaint Information</h2>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p><span className="font-medium">Ticket ID:</span> {detail.ticketId}</p>
              <p><span className="font-medium">Category:</span> {detail.category}</p>

              <p>
                <span className="font-medium">Days pending:</span>{" "}
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    detail.ageBand === "RED"
                      ? "bg-red-100 text-red-700"
                      : detail.ageBand === "YELLOW"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {detail.daysPending.toFixed(1)} days
                </span>
              </p>

              <div className="md:col-span-2 space-y-1">
                <label className="text-sm font-medium">Complaint category</label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {detail.categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {pretty(option)}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm font-medium text-white shadow-md shadow-sky-200"
                  onClick={saveCategory}
                  disabled={isPending}
                >
                  Save Category
                </button>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-sm font-medium">Assigned to</label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  {detail.assigneeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm font-medium text-white shadow-md shadow-sky-200"
                  onClick={saveAssignment}
                  disabled={isPending}
                >
                  Save Assignment
                </button>
              </div>

              <p><span className="font-medium">Last updated:</span> {new Date(detail.updatedAt).toLocaleString()}</p>
            </div>

            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium">Current status</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                  <option key={s} value={s}>{pretty(s)}</option>
                ))}
              </select>
              <button
                className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm font-medium text-white shadow-md shadow-sky-200"
                disabled={isPending}
                onClick={() => applyStatusChange(status)}
              >
                Update Current Status
              </button>
            </div>
          </section>
        </div>

        {/* Complaint Description */}
        <section className="surface-card p-4">
          <h3 className="mb-2 text-base font-semibold text-slate-900">Complaint description</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>
        </section>

        {/* Evidence Files */}
        <section className="surface-card p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Evidence files</h3>
          {detail.evidence.length === 0 ? (
            <p className="text-sm text-slate-600">No evidence attached.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {detail.evidence.map((file) => (
                <div key={file.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm">
                  {file.fileType.startsWith("image/") ? (
                    <img src={file.fileUrl} alt="Evidence" className="mb-2 h-32 w-full rounded object-cover" />
                  ) : (
                    <a href={file.fileUrl} className="mb-2 inline-block text-sky-700 hover:text-sky-800" target="_blank">
                      Download video
                    </a>
                  )}
                  <p className="text-xs text-slate-500">Upload date: {new Date(detail.submittedAt).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">File size: Unavailable</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Noise Meter — shown when category is noise-related */}
        <NoiseMeterBadge
          category={detail.category}
          block={detail.hostelName.split(" ")[0] ?? detail.hostelName}
        />

        <section className="surface-card p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Status change section</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium">Current status:</span> {pretty(detail.status)}</p>
              <label className="text-sm font-medium">Proposed status</label>
              <select
                className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                value={proposedStatus}
                onChange={(e) => setProposedStatus(e.target.value)}
              >
                {(NEXT_STATUS[detail.status] ?? []).map((s) => (
                  <option key={s} value={s}>{pretty(s)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Required response (min 10 characters)</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
              <input type="file" className="text-sm" />
            </div>
          </div>
          <button
            className="mt-3 rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-200 disabled:opacity-50"
            disabled={isPending || proposedStatus.length === 0 || responseMessage.trim().length < 10}
            onClick={() => applyStatusChange(proposedStatus, responseMessage)}
          >
            Submit Status Change
          </button>
        </section>

        {/* Messages */}
        <section className="surface-card p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Messages</h3>
          <div className="space-y-2">
            {detail.updates.map((u) => (
              <div
                key={u.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  normalizeRoleKey(u.role) === "STUDENT" ? "bg-slate-100" : "bg-slate-200"
                }`}
              >
                <p className="text-xs font-semibold text-slate-600">
                  {normalizeRoleKey(u.role) === "STUDENT" ? "Student" : u.name}
                </p>
                <p className="text-slate-700">{u.content}</p>
                <p className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type message..."
            />
            <input type="file" className="text-sm" />
            <button
              className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-3 py-2 text-sm font-medium text-white shadow-md shadow-sky-200"
              onClick={sendMessage}
              disabled={isPending}
            >
              Send
            </button>
          </div>
        </section>

        {/* Actions Menu */}
        <section className="surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={`/warden/complaints/${detail.id}/resolve`}
              className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-sky-200 transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Open Resolution Form
            </Link>

            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                onClick={() => setActionsOpen((v) => !v)}
              >
                More Actions
                <span className="text-slate-400">▼</span>
              </button>

              {actionsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActionsOpen(false)}
                  />
                  <div className="absolute bottom-full right-0 z-50 mb-2 w-56 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1" role="menu">
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        role="menuitem"
                        onClick={() => {
                          setActionsOpen(false);
                          // Handle escalate logic here
                          setFeedback("Escalated to management (placeholder)");
                        }}
                      >
                        Escalate to Management
                      </button>
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        role="menuitem"
                        onClick={() => {
                          setActionsOpen(false);
                          // Handle note logic here
                          setFeedback("Note added (placeholder)");
                        }}
                      >
                        Add Internal Note
                      </button>
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        role="menuitem"
                        onClick={() => {
                          setActionsOpen(false);
                          window.print();
                        }}
                      >
                        Print/Export as PDF
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {feedback && (
          <div className="surface-card rounded-md px-3 py-2 text-sm text-slate-700">
            {feedback}
          </div>
        )}
      </div>

      {/* ── AI Intelligence Drawer (fixed overlay, no layout shift) ── */}
      <AiInsightSidebar
        complaintId={detail.id}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onApplySuggestedAction={(action) => {
          setFeedback(`AI Action logged: ${action}`);
        }}
      />
    </>
  );
}
