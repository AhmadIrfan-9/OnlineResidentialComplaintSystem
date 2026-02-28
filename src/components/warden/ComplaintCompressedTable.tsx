"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { updateComplaintStatus } from "@/actions/complaints";
import type { QueueItem } from "@/components/warden/ComplaintQueueTable";

const STATUS_LABEL_MAP: Record<QueueItem["statusCode"], string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function ComplaintCompressedTable({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [statusByComplaint, setStatusByComplaint] = useState<Record<string, QueueItem["statusCode"]>>(
    () => Object.fromEntries(items.map((item) => [item.complaintId, item.statusCode]))
  );
  const [updatingComplaintId, setUpdatingComplaintId] = useState<string | null>(null);

  const rows = useMemo(
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

  const onStatusChange = async (complaintId: string, nextStatus: QueueItem["statusCode"]) => {
    const previous = statusByComplaint[complaintId];
    setStatusByComplaint((prev) => ({ ...prev, [complaintId]: nextStatus }));
    setUpdatingComplaintId(complaintId);

    const result = await updateComplaintStatus(complaintId, nextStatus);
    if (!result.success) {
      setStatusByComplaint((prev) => ({ ...prev, [complaintId]: previous }));
      window.alert(result.error ?? "Failed to update complaint status");
    }

    setUpdatingComplaintId(null);
    router.refresh();
  };

  return (
    <div className="surface-card overflow-x-auto p-0">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Ticket</th>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Student</th>
            <th className="px-3 py-2 text-left">Management</th>
            <th className="px-3 py-2 text-left">Evidence</th>
            <th className="px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.complaintId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-800">{item.ticketId}</td>
              <td className="px-3 py-2 text-slate-700">{item.title}</td>
              <td className="px-3 py-2">
                <select
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  value={item.statusCode}
                  disabled={updatingComplaintId === item.complaintId}
                  onChange={(event) =>
                    onStatusChange(item.complaintId, event.target.value as QueueItem["statusCode"])
                  }
                >
                  {Object.entries(STATUS_LABEL_MAP).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-slate-700">{item.student}</td>
              <td className="px-3 py-2 text-slate-700">{item.management}</td>
              <td className="px-3 py-2 text-slate-700">{item.evidences.length}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/warden/complaints/${item.complaintId}`}
                  className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
