"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addComplaintComment, updateComplaintStatus } from "@/actions/complaints";
import { normalizeRoleKey } from "@/lib/roles";

interface DetailData {
  id: string;
  ticketId: string;
  studentName: string;
  studentIdentifier: string;
  hostelName: string;
  contact: string;
  submissionMode: "Identified" | "Anonymous";
  submittedAt: string;
  category: string;
  severity: string;
  status: string;
  daysPending: number;
  assignedTo: string;
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
  SUBMITTED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["IN_PROGRESS", "RESOLVED"],
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

export function ManagementComplaintDetailClient({ detail }: { detail: DetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(detail.status);
  const [assignedTo, setAssignedTo] = useState(detail.assignedTo);
  const [proposedStatus, setProposedStatus] = useState(NEXT_STATUS[detail.status]?.[0] ?? "");
  const [responseMessage, setResponseMessage] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [feedback, setFeedback] = useState("");

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Student Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Student name:</span> {detail.studentName}</p>
            <p><span className="font-medium">Student ID:</span> {detail.studentIdentifier}</p>
            <p><span className="font-medium">Hostel:</span> {detail.hostelName}</p>
            <p><span className="font-medium">Contact:</span> {detail.contact}</p>
            <p><span className="font-medium">Submission date:</span> {new Date(detail.submittedAt).toLocaleString()}</p>
            <p>
              <span className="font-medium">Submission mode:</span>{" "}
              <span className={`rounded-full px-2 py-1 text-xs ${detail.isAnonymous ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"}`}>
                {detail.submissionMode}
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Complaint Information</h2>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><span className="font-medium">Ticket ID:</span> {detail.ticketId}</p>
            <p><span className="font-medium">Category:</span> {detail.category}</p>
            <p><span className="font-medium">Severity:</span> {detail.severity}</p>
            <p><span className="font-medium">Days pending:</span> <span className={detail.daysPending > 7 ? "text-red-600 font-semibold" : ""}>{detail.daysPending.toFixed(1)} days</span></p>
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium">Assigned to</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option>Unassigned</option>
                <option>My Assignments</option>
                <option>Team Alpha</option>
                <option>Team Bravo</option>
              </select>
            </div>
            <p><span className="font-medium">Last updated:</span> {new Date(detail.updatedAt).toLocaleString()}</p>
          </div>

          <div className="mt-3 space-y-2">
            <label className="text-sm font-medium">Current status</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["SUBMITTED", "ACKNOWLEDGED", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                <option key={s} value={s}>{pretty(s)}</option>
              ))}
            </select>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isPending}
              onClick={() => applyStatusChange(status)}
            >
              Update Current Status
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-base font-semibold text-slate-900">Complaint description</h3>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Evidence files</h3>
        {detail.evidence.length === 0 ? (
          <p className="text-sm text-slate-600">No evidence attached.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {detail.evidence.map((file) => (
              <div key={file.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                {file.fileType.startsWith("image/") ? (
                  <img src={file.fileUrl} alt="Evidence" className="mb-2 h-32 w-full rounded object-cover" />
                ) : (
                  <a href={file.fileUrl} className="mb-2 inline-block text-blue-600 underline" target="_blank">
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

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Status change section</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm"><span className="font-medium">Current status:</span> {pretty(detail.status)}</p>
            <label className="text-sm font-medium">Proposed status</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
            />
            <input type="file" className="text-sm" />
          </div>
        </div>
        <button
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isPending || proposedStatus.length === 0 || responseMessage.trim().length < 10}
          onClick={() => applyStatusChange(proposedStatus, responseMessage)}
        >
          Submit Status Change
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
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
            className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type message..."
          />
          <input type="file" className="text-sm" />
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onClick={sendMessage}
            disabled={isPending}
          >
            Send
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={sendMessage}>
            Send Message
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onClick={() => applyStatusChange("RESOLVED")}
            disabled={isPending}
          >
            Mark as Resolved
          </button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Escalate to Management</button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm">Add Note (internal)</button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => window.print()}>
            Print/Export as PDF
          </button>
          <Link href={`/warden/complaints/${detail.id}/resolve`} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">
            Open Resolution Form
          </Link>
        </div>
      </section>

      {feedback && (
        <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {feedback}
        </div>
      )}
    </div>
  );
}
