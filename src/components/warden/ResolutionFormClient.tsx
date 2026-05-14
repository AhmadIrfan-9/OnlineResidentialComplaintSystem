"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComplaintComment, updateComplaintStatus } from "@/actions/complaints";
import { CheckCircle2 } from "lucide-react";

const resolutionOptions = [
  "Fixed",
  "Forwarded",
  "Policy Decision",
  "No Action Required",
  "Unable to Resolve",
];

export function ResolutionFormClient({
  complaintId,
  ticketId,
}: {
  complaintId: string;
  ticketId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState(resolutionOptions[0]);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const today = new Date().toLocaleDateString("en-MY", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const submitResolution = () => {
    startTransition(async () => {
      const statusResult = await updateComplaintStatus(complaintId, "RESOLVED");
      if (!statusResult.success) {
        setFeedback({ type: "error", text: statusResult.error ?? "Failed to resolve complaint" });
        return;
      }
      const message = `Resolution submitted. Category: ${category}. Notes: ${
        notes.trim().length > 0 ? notes.trim() : "No additional notes."
      }`;
      await addComplaintComment(complaintId, message);
      setFeedback({ type: "success", text: "Resolution submitted successfully." });
      router.push(`/warden/complaints/${complaintId}`);
      router.refresh();
    });
  };

  return (
    <div className="surface-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-5 py-4">
        <CheckCircle2 className="h-4 w-4 text-blue-700" />
        <div>
          <h2 className="text-sm font-bold text-blue-900">Resolution Form</h2>
          <p className="text-xs text-blue-600 mt-0.5 font-mono">{ticketId}</p>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          Closure date: <span className="font-semibold text-slate-700">{today}</span>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Resolution category */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Resolution Category
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {resolutionOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* Resolution notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Resolution Notes <span className="font-normal normal-case text-slate-400">(optional)</span>
          </label>
          <textarea
            className="min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what was done to resolve this complaint…"
          />
        </div>

        {/* Summary preview */}
        {(category || notes) && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
            <span className="font-semibold">Preview: </span>
            Resolution: <em>{category}</em>
            {notes.trim() && <> — {notes.trim()}</>}
          </div>
        )}

        {/* Feedback */}
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

        <button
          className="btn-primary w-full justify-center py-2.5"
          disabled={isPending}
          onClick={submitResolution}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPending ? "Submitting Resolution…" : "Submit Resolution & Mark Resolved"}
        </button>
      </div>
    </div>
  );
}
