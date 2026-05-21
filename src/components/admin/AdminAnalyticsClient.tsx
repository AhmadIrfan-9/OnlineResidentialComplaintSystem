"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Users, FileText, TrendingUp, Clock, Activity } from "lucide-react";

type ChartPoint = { name: string; value: number };
type TrendPoint = { label: string; total: number; resolved: number };

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", "In Progress": "#3b82f6", Resolved: "#10b981", Closed: "#94a3b8",
};
const PRIORITY_COLORS: Record<string, string> = {
  Routine: "#3b82f6", Urgent: "#f59e0b", Emergency: "#ef4444",
};
const ROLE_COLORS = ["#3b82f6", "#10b981", "#dc2626", "#94a3b8"];
const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function KpiCard({
  label, value, sub, icon: Icon, color, borderCls,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; borderCls?: string;
}) {
  return (
    <div className={`surface-card p-5 ${borderCls ?? ""}`}>
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{children}</h2>
  );
}

export function AdminAnalyticsClient({
  kpis,
  statusData,
  priorityData,
  categoryData,
  hostelData,
  roleData,
  monthlyTrend,
  activeUsers,
  inactiveUsers,
}: {
  kpis: { totalComplaints: number; totalUsers: number; resolutionRate: number; pendingCount: number; activityCount: number };
  statusData: ChartPoint[];
  priorityData: ChartPoint[];
  categoryData: ChartPoint[];
  hostelData: ChartPoint[];
  roleData: ChartPoint[];
  monthlyTrend: TrendPoint[];
  activeUsers: number;
  inactiveUsers: number;
}) {
  return (
    <div className="space-y-5">
      {/* ── KPI Cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total Complaints" value={kpis.totalComplaints} icon={FileText}    color="bg-blue-100 text-blue-600"    borderCls="border-t-4 border-t-blue-500" />
        <KpiCard label="Total Users"      value={kpis.totalUsers}      icon={Users}       color="bg-violet-100 text-violet-600" borderCls="border-t-4 border-t-violet-500" />
        <KpiCard label="Resolution Rate"  value={`${kpis.resolutionRate}%`} sub="resolved + closed" icon={TrendingUp} color="bg-emerald-100 text-emerald-600" borderCls="border-t-4 border-t-emerald-500" />
        <KpiCard label="Pending"          value={kpis.pendingCount}    icon={Clock}       color="bg-amber-100 text-amber-600"   borderCls="border-t-4 border-t-amber-500" />
        <KpiCard label="System Activity"  value={kpis.activityCount}   sub="non-login events" icon={Activity}  color="bg-red-100 text-red-600" borderCls="border-t-4 border-t-red-500" />
      </div>

      {/* ── Monthly Trend ── */}
      <div className="surface-card p-5">
        <SectionTitle>Monthly Complaint Trend (Last 6 Months)</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="total"    name="Submitted" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="resolved" name="Resolved"  stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Status + Priority ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <SectionTitle>Complaints by Status</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[s.name] ?? "#94a3b8" }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <SectionTitle>Complaints by Priority</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" radius={[6, 6, 0, 0]}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Category + Hostel ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <SectionTitle>Complaints by Category (Top 8)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" radius={[0, 6, 6, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-5">
          <SectionTitle>Complaints by Hostel</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hostelData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── User Breakdown ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <SectionTitle>Users by Role</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={roleData.filter(r => r.name !== "Inactive")} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {roleData.filter(r => r.name !== "Inactive").map((_, i) => (
                  <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-5">
          <SectionTitle>User Account Status</SectionTitle>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium text-slate-700">Active Users</span>
                <span className="font-bold text-emerald-600">{activeUsers}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${activeUsers + inactiveUsers > 0 ? (activeUsers / (activeUsers + inactiveUsers)) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium text-slate-700">Inactive Users</span>
                <span className="font-bold text-slate-500">{inactiveUsers}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 transition-all"
                  style={{ width: `${activeUsers + inactiveUsers > 0 ? (inactiveUsers / (activeUsers + inactiveUsers)) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="pt-2 text-center text-2xl font-bold text-slate-900">
              {activeUsers + inactiveUsers} <span className="text-sm font-normal text-slate-400">total</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
