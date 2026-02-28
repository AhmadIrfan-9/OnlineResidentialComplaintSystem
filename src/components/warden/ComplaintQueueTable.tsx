"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, MessageSquare, TriangleAlert, UserPlus2 } from "lucide-react";
import { updateComplaintStatus } from "@/actions/complaints";

export interface QueueItem {
  complaintId: string;
  title: string;
  ticketId: string;
  statusCode: "SUBMITTED" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  status: string;
  severity: string;
  submitted: string;
  daysPending: number;
  student: string;
  management: string;
  category: string;
  assignedTo: string;
  ageBand: "GREEN" | "YELLOW" | "RED";
  evidences: Array<{
    id: string;
    fileUrl: string;
    fileType: string;
    uploadDate?: string | null;
    uploaderId?: string | null;
    virusScanStatus?: string | null;
  }>;
  messageHistory: Array<{
    content: string;
    createdAt: string;
  }>;
}

const rowColor = (ageBand: QueueItem["ageBand"]): string => {
  if (ageBand === "RED") return "bg-red-50/80 hover:bg-red-100";
  if (ageBand === "YELLOW") return "bg-amber-50/80 hover:bg-amber-100";
  return "bg-emerald-50/80 hover:bg-emerald-100";
};

type SortKey = keyof Pick<
  QueueItem,
  "ticketId" | "status" | "severity" | "submitted" | "daysPending" | "student" | "category" | "assignedTo"
>;

const STATUS_LABEL_MAP: Record<QueueItem["statusCode"], string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function ComplaintQueueTable({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [statusByComplaint, setStatusByComplaint] = useState<Record<string, QueueItem["statusCode"]>>(
    () => Object.fromEntries(items.map((item) => [item.complaintId, item.statusCode]))
  );
  const [updatingComplaintId, setUpdatingComplaintId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [assignedFilter, setAssignedFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const itemsWithLiveStatus = useMemo(
    () =>
      items.map((item) => {
        const statusCode = statusByComplaint[item.complaintId] ?? item.statusCode;
        return {
          ...item,
          statusCode,
          status: STATUS_LABEL_MAP[statusCode],
        };
      }),
    [items, statusByComplaint]
  );

  const filtered = useMemo(() => {
    const lowered = (v: string) => v.toLowerCase();
    return itemsWithLiveStatus
      .filter((item) =>
        statusFilter === "All" ? true : lowered(item.status) === lowered(statusFilter)
      )
      .filter((item) =>
        severityFilter === "All" ? true : lowered(item.severity) === lowered(severityFilter)
      )
      .filter((item) => {
        if (assignedFilter === "All") return true;
        if (assignedFilter === "Unassigned") return item.assignedTo === "Unassigned";
        return item.assignedTo !== "Unassigned";
      })
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const base =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return sortOrder === "asc" ? base : -base;
      });
  }, [assignedFilter, itemsWithLiveStatus, severityFilter, sortKey, sortOrder, statusFilter]);

  const handleStatusChange = async (complaintId: string, nextStatus: QueueItem["statusCode"]) => {
    const previousStatus = statusByComplaint[complaintId];
    setStatusByComplaint((prev) => ({ ...prev, [complaintId]: nextStatus }));
    setUpdatingComplaintId(complaintId);

    const result = await updateComplaintStatus(complaintId, nextStatus);
    if (!result.success) {
      setStatusByComplaint((prev) => ({ ...prev, [complaintId]: previousStatus }));
      window.alert(result.error ?? "Failed to update complaint status");
    }

    setUpdatingComplaintId(null);
    router.refresh();
  };

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder("asc");
  };

  return (
    <div className="space-y-3">
      <div className="surface-card grid gap-2 p-3 md:grid-cols-3 lg:grid-cols-5">
        <select
          className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Submitted</option>
          <option>Acknowledged</option>
          <option>Under Review</option>
          <option>In Progress</option>
          <option>Resolved</option>
          <option>Closed</option>
        </select>

        <select
          className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option>All</option>
          <option>Routine</option>
          <option>Urgent</option>
          <option>Emergency</option>
        </select>

        <select
          className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
        >
          <option>All</option>
          <option>My Assignments</option>
          <option>Unassigned</option>
        </select>
      </div>

      {selectedCount > 1 && (
        <div className="surface-card flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="font-medium text-slate-700">{selectedCount} selected</span>
          <button className="nav-pill px-3 py-1">Assign to...</button>
          <button className="nav-pill px-3 py-1">Change Status...</button>
          <button className="nav-pill px-3 py-1">Close Selected</button>
        </div>
      )}

      <div className="surface-card overflow-x-auto p-0">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left"></th>
              {[
                ["ticketId", "Ticket ID"],
                ["status", "Status"],
                ["severity", "Severity"],
                ["submitted", "Submitted"],
                ["daysPending", "Days Pending"],
                ["student", "Student"],
                ["category", "Category"],
                ["assignedTo", "Assigned To"],
              ].map(([key, label]) => (
                <th key={key} className="px-3 py-3 text-left">
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => toggleSort(key as SortKey)}
                  >
                    {label}
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                  No complaints found for the current filters.
                </td>
              </tr>
            ) : (
              paged.map((item) => (
                <tr
                  key={item.complaintId}
                  className={`group cursor-pointer border-t border-slate-100 ${rowColor(item.ageBand)}`}
                  onClick={() => router.push(`/warden/complaints/${item.complaintId}`)}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.complaintId])}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [item.complaintId]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-800">
                    <Link href={`/warden/complaints/${item.complaintId}`} onClick={(e) => e.stopPropagation()}>
                      {item.ticketId}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                      value={statusByComplaint[item.complaintId] ?? item.statusCode}
                      disabled={updatingComplaintId === item.complaintId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        handleStatusChange(
                          item.complaintId,
                          e.target.value as QueueItem["statusCode"]
                        )
                      }
                    >
                      <option value="SUBMITTED">Submitted</option>
                      <option value="ACKNOWLEDGED">Acknowledged</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">{item.severity}</td>
                  <td className="px-3 py-3">{new Date(item.submitted).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        item.ageBand === "RED"
                          ? "bg-red-100 text-red-700"
                          : item.ageBand === "YELLOW"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {item.daysPending}
                    </span>
                  </td>
                  <td className="px-3 py-3">{item.student}</td>
                  <td className="px-3 py-3">{item.category}</td>
                  <td className="px-3 py-3">{item.assignedTo}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Link
                        href={`/warden/complaints/${item.complaintId}`}
                        className="nav-pill px-2 py-1 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                      <button
                        className="nav-pill inline-flex items-center gap-1 px-2 py-1 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <UserPlus2 className="h-3 w-3" /> Assign to Me
                      </button>
                      <button
                        className="nav-pill inline-flex items-center gap-1 px-2 py-1 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageSquare className="h-3 w-3" /> Message
                      </button>
                      <button
                        className="nav-pill inline-flex items-center gap-1 px-2 py-1 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TriangleAlert className="h-3 w-3" /> Escalate
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of{" "}
          {filtered.length}
        </p>
        <div className="flex gap-2">
          <button
            className="nav-pill px-3 py-1 disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="nav-pill px-3 py-1 disabled:opacity-50"
            disabled={page * pageSize >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
