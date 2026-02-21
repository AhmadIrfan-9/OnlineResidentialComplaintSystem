"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComplaintComment, updateComplaintStatus } from "@/actions/complaints";

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
  const [feedback, setFeedback] = useState("");

  const today = new Date().toLocaleDateString();

  const submitResolution = () => {
    startTransition(async () => {
      const statusResult = await updateComplaintStatus(complaintId, "RESOLVED");
      if (!statusResult.success) {
        setFeedback(statusResult.error ?? "Failed to resolve complaint");
        return;
      }

      const message = `Resolution submitted. Category: ${category}. Notes: ${
        notes.trim().length > 0 ? notes.trim() : "No additional notes."
      }`;
      await addComplaintComment(complaintId, message);
      setFeedback("Resolution submitted successfully.");
      router.push(`/warden/complaints/${complaintId}`);
      router.refresh();
    });
  };

  return (
    <section className="surface-card p-4 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Resolve Complaint {ticketId}</h2>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Resolution category</label>
          <select
            className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {resolutionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Resolution notes</label>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>

        <div className="space-y-1 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">Closure date:</span> {today}
          </p>
        </div>

        <button
          className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-200 disabled:opacity-50"
          disabled={isPending}
          onClick={submitResolution}
        >
          {isPending ? "Submitting..." : "Submit Resolution"}
        </button>

        {feedback && <p className="text-sm text-slate-700">{feedback}</p>}
      </div>
    </section>
  );
}
