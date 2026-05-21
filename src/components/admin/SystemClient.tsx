"use client";

import { useState } from "react";
import { Activity, Settings, FileText, CheckCircle2, XCircle, Database, Mail, Server, Clock, Cpu } from "lucide-react";
import { formatDateTimeMYT } from "@/lib/format-date";
import { ConfigurationManagementClient } from "./ConfigurationManagementClient";
import { AuditLogsClient } from "./AuditLogsClient";

type SystemStats = {
  totalUsers: number;
  totalComplaints: number;
  activeUsers: number;
};

type HealthStatus = {
  database: boolean;
  email: boolean;
  ai: boolean;
};

type Tab = "health" | "config" | "audit";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "health", label: "Health",        icon: Activity  },
  { id: "config", label: "Configuration", icon: Settings  },
  { id: "audit",  label: "Audit Logs",    icon: FileText  },
];

export function SystemClient({
  stats,
  userOptions,
  health,
}: {
  stats: SystemStats;
  userOptions: string[];
  health: HealthStatus;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("health");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="surface-card flex gap-1 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
              activeTab === id
                ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-200"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Health tab */}
      {activeTab === "health" && (
        <div className="space-y-4">
          {/* Service status */}
          <div className="grid gap-3 md:grid-cols-3">
            {([
              { label: "Database",      icon: Database, ok: health.database,  okLabel: "Online",     failLabel: "Unreachable" },
              { label: "Email Service", icon: Mail,     ok: health.email,     okLabel: "Configured", failLabel: "Not configured" },
              { label: "AI Service",    icon: Cpu,      ok: health.ai,        okLabel: "Configured", failLabel: "Not configured" },
            ] as const).map(({ label, icon: Icon, ok, okLabel, failLabel }) => (
              <div key={label} className="surface-card p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
                <p className={`mt-2 flex items-center gap-2 font-semibold ${ok ? "text-emerald-700" : "text-red-600"}`}>
                  {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {ok ? okLabel : failLabel}
                </p>
                <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDateTimeMYT(new Date())} MYT
                </p>
              </div>
            ))}
          </div>

          {/* System snapshot */}
          <div className="surface-card p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">System Snapshot</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4">
                <p className="text-xs text-slate-500">Total Users</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
                <p className="mt-0.5 text-xs text-emerald-600">{stats.activeUsers} active</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-4">
                <p className="text-xs text-slate-500">Total Complaints</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalComplaints}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                <p className="text-xs text-slate-500">Inactive Users</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalUsers - stats.activeUsers}</p>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="surface-card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("config")}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
              >
                Manage Configuration
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
              >
                View Audit Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration tab */}
      {activeTab === "config" && <ConfigurationManagementClient />}

      {/* Audit Logs tab */}
      {activeTab === "audit" && <AuditLogsClient userOptions={userOptions} />}
    </div>
  );
}
