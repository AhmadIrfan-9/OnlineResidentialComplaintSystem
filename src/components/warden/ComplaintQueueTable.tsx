"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, MessageSquare, TriangleAlert, UserPlus2 } from "lucide-react";

export interface QueueItem {
  complaintId: string;
  ticketId: string;
  status: string;
  severity: string;
  submitted: string;
  daysPending: number;
  student: string;
  category: string;
  assignedTo: string;
  slaState: "OVERDUE" | "APPROACHING" | "WITHIN";
}

const rowColor = (slaState: QueueItem["slaState"]): string => {
  if (slaState === "OVERDUE") return "bg-red-50 hover:bg-red-100";
  if (slaState === "APPROACHING") return "bg-amber-50 hover:bg-amber-100";
  return "bg-emerald-50 hover:bg-emerald-100";
};

type SortKey = keyof Pick<
  QueueItem,
  "ticketId" | "status" | "severity" | "submitted" | "daysPending" | "student" | "category" | "assignedTo"
>;

export function ComplaintQueueTable({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [assignedFilter, setAssignedFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const lowered = (v: string) => v.toLowerCase();
    return items
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
  }, [assignedFilter, items, severityFilter, sortKey, sortOrder, statusFilter]);

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
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-5">
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option>All</option>
          <option>Routine</option>
          <option>Urgent</option>
          <option>Emergency</option>
        </select>

        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
        >
          <option>All</option>
          <option>My Assignments</option>
          <option>Unassigned</option>
        </select>
      </div>

      {selectedCount > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <span className="font-medium text-slate-700">{selectedCount} selected</span>
          <button className="rounded border border-slate-300 px-3 py-1">Assign to...</button>
          <button className="rounded border border-slate-300 px-3 py-1">Change Status...</button>
          <button className="rounded border border-slate-300 px-3 py-1">Close Selected</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
            {paged.map((item) => (
              <tr
                key={item.complaintId}
                className={`group cursor-pointer border-t border-slate-100 ${rowColor(item.slaState)}`}
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
                <td className="px-3 py-3">{item.status}</td>
                <td className="px-3 py-3">{item.severity}</td>
                <td className="px-3 py-3">{new Date(item.submitted).toLocaleDateString()}</td>
                <td className="px-3 py-3">{item.daysPending}</td>
                <td className="px-3 py-3">{item.student}</td>
                <td className="px-3 py-3">{item.category}</td>
                <td className="px-3 py-3">{item.assignedTo}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <Link
                      href={`/warden/complaints/${item.complaintId}`}
                      className="rounded border px-2 py-1 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                    <button
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <UserPlus2 className="h-3 w-3" /> Assign to Me
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquare className="h-3 w-3" /> Message
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TriangleAlert className="h-3 w-3" /> Escalate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
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
