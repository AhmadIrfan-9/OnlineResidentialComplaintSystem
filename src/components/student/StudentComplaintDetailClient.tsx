"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComplaintComment } from "@/actions/complaints";
import { type ComplaintCategory, type Priority } from "@/lib/validations";

interface Props {
  complaintId: string;
  status: string;
  initialTitle: string;
  initialDescription: string;
  initialCategory: ComplaintCategory;
  initialPriority: Priority;
  initialAnonymous: boolean;
}

const EDITABLE_STATUSES = new Set(["SUBMITTED", "ACKNOWLEDGED"]);

export function StudentComplaintDetailClient({
  complaintId,
  status,
  initialTitle,
  initialDescription,
  initialCategory,
  initialPriority,
  initialAnonymous,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState<ComplaintCategory>(initialCategory);
  const [priority, setPriority] = useState<Priority>(initialPriority);
  const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const canEdit = EDITABLE_STATUSES.has(status);

  const sendMessage = () => {
    if (message.trim().length < 2) {
      setFeedback("Message must be at least 2 characters.");
      return;
    }

    startTransition(async () => {
      const result = await addComplaintComment(complaintId, message);
      if (!result.success) {
        setFeedback(result.error ?? "Failed to send message.");
        return;
      }
      setMessage("");
      setFeedback("Message sent.");
      router.refresh();
    });
  };

  const saveChanges = () => {
    startTransition(async () => {
      const response = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          isAnonymous,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.message ?? "Failed to update complaint.");
        return;
      }
      setEditing(false);
      setFeedback("Complaint updated.");
      router.refresh();
    });
  };

  const deleteComplaint = () => {
    if (!window.confirm("Delete this complaint permanently?")) return;

    startTransition(async () => {
      const response = await fetch(`/api/complaints/${complaintId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setFeedback(data.message ?? "Failed to delete complaint.");
        return;
      }
      router.push("/complaints");
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <div className="surface-card p-4">
        <h2 className="text-base font-semibold text-slate-900">Complaint actions</h2>
        <p className="mt-1 text-sm text-slate-600">
          Editable only while status is Submitted or Acknowledged.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-sky-50 disabled:opacity-50"
            onClick={() => setEditing((prev) => !prev)}
            disabled={!canEdit || isPending}
          >
            {editing ? "Cancel Edit" : "Edit Complaint"}
          </button>
          <button
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
            onClick={deleteComplaint}
            disabled={!canEdit || isPending}
          >
            Delete Complaint
          </button>
        </div>
        {editing ? (
          <div className="mt-3 grid gap-2">
            <input
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="min-h-28 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-3">
              <select
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              >
                {[
                  "PLUMBING",
                  "WIFI",
                  "ELECTRIC",
                  "CLEANING",
                  "FURNITURE",
                  "MAINTENANCE",
                  "NOISE",
                  "SECURITY",
                  "OTHER",
                ].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {["ROUTINE", "URGENT", "EMERGENCY"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                Anonymous
              </label>
            </div>
            <button
              className="w-fit rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={saveChanges}
              disabled={isPending}
            >
              Save Changes
            </button>
          </div>
        ) : null}
      </div>

      <div className="surface-card p-4">
        <h2 className="text-base font-semibold text-slate-900">Message management</h2>
        <textarea
          className="mt-3 min-h-28 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          placeholder="Ask for updates or provide more details..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            className="rounded-md bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={sendMessage}
            disabled={isPending}
          >
            Send Message
          </button>
        </div>
        {feedback ? <p className="mt-2 text-sm text-slate-600">{feedback}</p> : null}
      </div>
    </section>
  );
}
