"use client";

import { useEffect, useMemo, useState } from "react";

type AuditAction = "Login" | "Create" | "Update" | "Delete" | "View";

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

export function AuditLogsClient({ userOptions }: { userOptions: string[] }) {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (userFilter && userFilter !== "All") params.set("user", userFilter);
    if (actionFilter && actionFilter !== "All") params.set("action", actionFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    return params.toString();
  }, [actionFilter, fromDate, toDate, userFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/audit-logs${query ? `?${query}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.message ?? "Failed to load audit logs");
        return;
      }

      const nextRows = (data.logs ?? []).map(
        (row: {
          timestamp: string;
          userName: string;
          action: AuditAction;
          resource: string;
          before: string | null;
          after: string | null;
          ipAddress: string | null;
        }) => ({
          timestamp: row.timestamp,
          user: row.userName,
          action: row.action,
          resource: row.resource,
          before: row.before ?? "",
          after: row.after ?? "",
          ip: row.ipAddress ?? "-",
        })
      );
      setRows(nextRows);
      setNotice("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const exportCsv = () => {
    if (rows.length === 0) {
      setNotice("No rows to export.");
      return;
    }

    const header = ["Timestamp", "User", "Action", "Resource", "Before", "After", "IP Address"].join(",");
    const lines = rows.map((row) =>
      [
        toCsvSafe(new Date(row.timestamp).toISOString()),
        toCsvSafe(row.user),
        toCsvSafe(row.action),
        toCsvSafe(row.resource),
        toCsvSafe(row.before || "-"),
        toCsvSafe(row.after || "-"),
        toCsvSafe(row.ip),
      ].join(",")
    );

    const blob = new Blob([`${header}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {notice ? (
        <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-4">
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option>All</option>
          {userOptions.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option>All</option>
          <option>Login</option>
          <option>Create</option>
          <option>Update</option>
          <option>Delete</option>
          <option>View</option>
        </select>

        <input
          type="date"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          type="date"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={loadLogs}>
          Filter
        </button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={exportCsv}>
          Export to CSV
        </button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => window.print()}>
          Print
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading logs...</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2">Timestamp</th>
              <th className="py-2">User</th>
              <th className="py-2">Action</th>
              <th className="py-2">Resource</th>
              <th className="py-2">Before</th>
              <th className="py-2">After</th>
              <th className="py-2">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.timestamp}-${idx}`} className="border-t border-slate-100">
                <td className="py-2 text-slate-700">{new Date(row.timestamp).toLocaleString()}</td>
                <td className="py-2 text-slate-700">{row.user}</td>
                <td className="py-2 text-slate-700">{row.action}</td>
                <td className="py-2 text-slate-700">{row.resource}</td>
                <td className="py-2 text-slate-600">{row.before || "-"}</td>
                <td className="py-2 text-slate-600">{row.after || "-"}</td>
                <td className="py-2 text-slate-600">{row.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
