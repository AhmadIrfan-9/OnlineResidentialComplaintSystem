"use client";

import { useState } from "react";
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
const ROLE_COLORS: Record<string, string> = {
  Student: "#10b981",    // Emerald Green
  Management: "#3b82f6", // Blue
  Admin: "#dc2626",      // Red
};
const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function normalizeCategory(cat: string): string {
  if (!cat) return "Others";
  const lower = cat.trim().toLowerCase();
  if (lower === "plumbing") return "Plumbing";
  if (lower === "wifi" || lower === "wi-fi" || lower === "internet") return "WiFi";
  if (lower === "electrical" || lower === "electric" || lower === "electricity") return "Electrical";
  if (lower === "furniture") return "Furniture";
  if (lower === "water") return "Water";
  if (lower === "noise") return "Noise";
  if (lower === "security") return "Security";
  return "Others";
}

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
    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h2>
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
  allComplaints = [],
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
  allComplaints?: { status: string; category: string; hostel: { name: string } }[];
}) {
  const [statusHostelFilter, setStatusHostelFilter] = useState<"Overall" | "Cendikiawan" | "Murni" | "Amanah" | "Ilmu">("Overall");
  const [categoryHostelFilter, setCategoryHostelFilter] = useState<"Overall" | "Ilmu" | "Amanah" | "Murni" | "Cendikiawan">("Overall");

  const complaints = allComplaints || [];

  // 1. Dynamic Status Data Aggregation
  const filteredStatusComplaints = statusHostelFilter === "Overall"
    ? complaints
    : complaints.filter(c => c.hostel?.name?.toLowerCase() === statusHostelFilter.toLowerCase());

  const statusCounts: Record<string, number> = {
    "Pending": 0,
    "In Progress": 0,
    "Resolved": 0,
    "Closed": 0,
  };

  const STATUS_MAP: Record<string, string> = {
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };

  filteredStatusComplaints.forEach((c) => {
    const mapped = STATUS_MAP[c.status] || "Pending";
    statusCounts[mapped] = (statusCounts[mapped] || 0) + 1;
  });

  const currentStatusData = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // 2. Dynamic Category Data Aggregation & Normalization
  const filteredCategoryComplaints = categoryHostelFilter === "Overall"
    ? complaints
    : complaints.filter(c => c.hostel?.name?.toLowerCase() === categoryHostelFilter.toLowerCase());

  const categoryCounts: Record<string, number> = {
    "Plumbing": 0,
    "WiFi": 0,
    "Electrical": 0,
    "Furniture": 0,
    "Water": 0,
    "Noise": 0,
    "Security": 0,
    "Others": 0,
  };

  filteredCategoryComplaints.forEach((c) => {
    const norm = normalizeCategory(c.category);
    categoryCounts[norm] = (categoryCounts[norm] || 0) + 1;
  });

  const currentCategoryData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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
        <div className="mb-4">
          <SectionTitle>Monthly Complaint Trend (Last 6 Months)</SectionTitle>
        </div>
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

      {/* ── Status ── */}
      <div className="surface-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
          <SectionTitle>Complaints by Status</SectionTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter by Hostel:</span>
            <select
              value={statusHostelFilter}
              onChange={(e) => setStatusHostelFilter(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer hover:border-slate-300"
            >
              <option value="Overall">Overall</option>
              <option value="Cendikiawan">Cendikiawan</option>
              <option value="Murni">Murni</option>
              <option value="Amanah">Amanah</option>
              <option value="Ilmu">Ilmu</option>
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Pie
              data={currentStatusData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value, percent }) => value > 0 ? `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)` : ""}
              labelLine={true}
            >
              {currentStatusData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {currentStatusData.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[s.name] ?? "#94a3b8" }} />
              {s.name} ({s.value})
            </span>
          ))}
        </div>
      </div>

      {/* ── Category + Hostel ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-100 pb-3">
            <SectionTitle>Complaints by Category</SectionTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter by Hostel:</span>
              <select
                value={categoryHostelFilter}
                onChange={(e) => setCategoryHostelFilter(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer hover:border-slate-300"
              >
                <option value="Overall">Overall</option>
                <option value="Ilmu">Ilmu</option>
                <option value="Amanah">Amanah</option>
                <option value="Murni">Murni</option>
                <option value="Cendikiawan">Cendikiawan</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={currentCategoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" name="Complaints" radius={[0, 6, 6, 0]}>
                {currentCategoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4">
            <SectionTitle>Complaints by Hostel</SectionTitle>
          </div>
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
          <div className="mb-4">
            <SectionTitle>Users by Role</SectionTitle>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={roleData.filter((r) => r.name !== "Inactive")}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name} (${value})`}
              >
                {roleData
                  .filter((r) => r.name !== "Inactive")
                  .map((entry) => (
                    <Cell key={entry.name} fill={ROLE_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {roleData
              .filter((r) => r.name !== "Inactive")
              .map((r) => (
                <span key={r.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ background: ROLE_COLORS[r.name] ?? "#94a3b8" }}
                  />
                  {r.name} ({r.value})
                </span>
              ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4">
            <SectionTitle>User Account Status</SectionTitle>
          </div>
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
