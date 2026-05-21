"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type AuditAction = "Create" | "Update" | "Delete";

type AuditLogRow = {
  timestamp: string;
  user: string;
  action: AuditAction;
  resource: string;
  before: string;
  after: string;
  ip: string;
};

const toCsvSafe = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

const actionBadge = (action: AuditAction) => {
  switch (action) {
    case "Delete": return "bg-red-50 text-red-700 border-red-200";
    case "Create": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Update": return "bg-blue-50 text-blue-700 border-blue-200";
    default:       return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export function AuditLogsClient({ userOptions }: { userOptions: string[] }) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (userFilter && userFilter !== "All") params.set("user", userFilter);
    if (actionFilter && actionFilter !== "All") params.set("action", actionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return params.toString();
  }, [actionFilter, fromDate, toDate, userFilter]);

  const loadLogs = async (q?: string) => {
    setLoading(true);
    try {
      const qs = q ?? query;
      const response = await fetch(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setNotice(data.message ?? "Failed to load audit logs"); return; }
      const nextRows = (data.logs ?? []).map(
        (row: {
          timestamp: string; userName: string; action: AuditAction;
          resource: string; before: string | null; after: string | null; ipAddress: string | null;
        }) => ({
          timestamp: row.timestamp, user: row.userName, action: row.action,
          resource: row.resource, before: row.before ?? "", after: row.after ?? "", ip: row.ipAddress ?? "-",
        })
      );
      setRows(nextRows);
      setNotice("");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, []);

  const exportCsv = () => {
    if (rows.length === 0) { setNotice("No rows to export."); return; }
    const header = ["Timestamp", "User", "Action", "Resource", "Before", "After", "IP Address"].join(",");
    const lines = rows.map((row) =>
      [
        toCsvSafe(new Date(row.timestamp).toISOString()),
        toCsvSafe(row.user), toCsvSafe(row.action), toCsvSafe(row.resource),
        toCsvSafe(row.before || "-"), toCsvSafe(row.after || "-"), toCsvSafe(row.ip),
      ].join(",")
    );
    const blob = new Blob([`${header}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {notice && (
        <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option>All</option>
          {userOptions.map((u) => <option key={u}>{u}</option>)}
        </select>

        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option>All</option>
          <option>Create</option>
          <option>Update</option>
          <option>Delete</option>
        </select>

        <input type="date" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={toDate} onChange={(e) => setToDate(e.target.value)} />

        <div className="ml-auto flex gap-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
            onClick={() => loadLogs()}
          >
            Filter
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500 italic">Loading activity logs…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400 italic">No significant activity found.</p>
      ) : (
        <div className="rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row, idx) => (
                <tr
                  key={`${row.timestamp}-${idx}`}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setSelectedRow(row)}
                >
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(row.timestamp).toLocaleString()}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{row.user}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={actionBadge(row.action)}>
                      {row.action}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{row.resource}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">{row.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail modal ── */}
      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="sm:max-w-[600px] bg-slate-50 border-slate-200 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Activity Detail</DialogTitle>
            <DialogDescription>Full record of this system event.</DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-4 text-sm mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-slate-500 block text-xs uppercase">Timestamp</span>
                  <p className="font-medium text-slate-900">{new Date(selectedRow.timestamp).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-xs uppercase">User</span>
                  <p className="font-medium text-slate-900">{selectedRow.user}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-xs uppercase">Action</span>
                  <Badge variant="outline" className={actionBadge(selectedRow.action)}>{selectedRow.action}</Badge>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 block text-xs uppercase">IP Address</span>
                  <p className="font-medium text-slate-900 font-mono text-xs">{selectedRow.ip}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-slate-500 block text-xs uppercase">Resource</span>
                  <p className="font-medium text-slate-900">{selectedRow.resource}</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block text-xs uppercase">Before</span>
                <div className="bg-white p-3 rounded-md border border-slate-200 text-slate-700 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                  {selectedRow.before || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block text-xs uppercase">After</span>
                <div className="bg-white p-3 rounded-md border border-slate-200 text-slate-700 font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                  {selectedRow.after || "N/A"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
