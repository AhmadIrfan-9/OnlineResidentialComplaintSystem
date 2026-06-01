import Link from "next/link";
import { redirect } from "next/navigation";
import { type Status } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileClock,
  ChevronRight,
  TrendingUp,
  Lightbulb,
  BarChart2,
  ClipboardList,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, isManagementRole, normalizeRoleKey } from "@/lib/roles";
import { getUnitenSemester } from "@/lib/semester";
import { PageHeader } from "@/components/shared/PageHeader";

const STATUS_OPEN: Status[] = ["PENDING", "IN_PROGRESS"];
const asDays = (ms: number): number => ms / (1000 * 60 * 60 * 24);

const chartStrokePoints = (values: number[], width = 120, height = 30): string => {
  if (values.length === 0) return "";
  const maxVal = Math.max(...values, 1) * 1.2;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => `${i * stepX},${height - (v / maxVal) * height}`)
    .join(" ");
};

const Sparkline = ({ data, stroke }: { data: number[]; stroke: string }) => (
  <div className="mt-3 h-8 w-32 opacity-80">
    <svg width="100%" height="100%" viewBox="0 0 120 30" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={chartStrokePoints(data)}
      />
    </svg>
  </div>
);

export default async function ManagementDashboardPage() {
  const session = await auth();
  const role = normalizeRoleKey(session?.user?.role);

  if (!session?.user || (!isManagementRole(role) && !isAdminRole(role))) {
    redirect("/login");
  }

  const assignedHostels = await db.hostel.findMany({
    where: role === "MANAGEMENT" ? { wardenId: session.user.id } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedHostels =
    assignedHostels.length > 0
      ? assignedHostels
      : await db.hostel.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  if (scopedHostels.length === 0) {
    return (
      <main className="min-h-screen p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          No hostel is configured yet. Please create at least one hostel in admin settings.
        </div>
      </main>
    );
  }

  const scopeLabel =
    scopedHostels.length === 1 ? scopedHostels[0].name : `${scopedHostels.length} hostels`;

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 29);
  start30.setHours(0, 0, 0, 0);

  const start14 = new Date(now);
  start14.setDate(now.getDate() - 13);
  start14.setHours(0, 0, 0, 0);

  const semester = getUnitenSemester(now);
  const slaSettings = await db.adminSlaSetting.findFirst();
  const warningDays = slaSettings?.warningThresholdDays ?? 30;
  const safeDays = slaSettings?.safeThresholdDays ?? 14;

  const monthComplaints = await db.complaint.findMany({
    where: {
      hostelId: { in: scopedHostels.map((h) => h.id) },
      createdAt: { gte: start30 },
    },
    select: {
      id: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
      studentProfile: { select: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingComplaints = monthComplaints.filter((c) => STATUS_OPEN.includes(c.status)).length;
  const overdueComplaints = monthComplaints.filter((c) => {
    if (!STATUS_OPEN.includes(c.status)) return false;
    return asDays(now.getTime() - c.createdAt.getTime()) > warningDays;
  }).length;

  const resolvedMonth = monthComplaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  );
  const avgResponseTimeDays =
    resolvedMonth.length === 0
      ? 0
      : resolvedMonth.reduce((acc, c) => {
          const end = c.resolvedAt ?? c.closedAt ?? c.updatedAt;
          return acc + asDays(end.getTime() - c.createdAt.getTime());
        }, 0) / resolvedMonth.length;

  const slaCompliantCount = monthComplaints.filter((c) => {
    const end = STATUS_OPEN.includes(c.status)
      ? now
      : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
    return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
  }).length;
  const slaCompliance = monthComplaints.length
    ? (slaCompliantCount / monthComplaints.length) * 100
    : 0;

  // 14-day sparkline data
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start14);
    d.setDate(start14.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const sparklinePending = last14Days.map(
    (day) => monthComplaints.filter((c) => c.createdAt.toDateString() === day.toDateString()).length
  );
  const sparklineResolved = last14Days.map(
    (day) =>
      resolvedMonth.filter(
        (c) => (c.resolvedAt || c.updatedAt).toDateString() === day.toDateString()
      ).length
  );
  const sparklineSLA = last14Days.map((day) => {
    const dayC = monthComplaints.filter((c) => c.createdAt.toDateString() === day.toDateString());
    if (dayC.length === 0) return slaCompliance;
    const compliant = dayC.filter((c) => {
      const end = STATUS_OPEN.includes(c.status) ? now : c.resolvedAt ?? c.closedAt ?? c.updatedAt;
      return asDays(end.getTime() - c.createdAt.getTime()) <= safeDays;
    }).length;
    return (compliant / dayC.length) * 100;
  });

  const highPriorityLatest = monthComplaints
    .filter((c) => {
      if (!STATUS_OPEN.includes(c.status)) return false;
      if (c.priority === "EMERGENCY" || c.priority === "URGENT") return true;
      const daysOpen = asDays(now.getTime() - c.createdAt.getTime());
      return daysOpen >= 8;
    })
    .sort((a, b) => {
      if (a.priority === "EMERGENCY" && b.priority !== "EMERGENCY") return -1;
      if (a.priority !== "EMERGENCY" && b.priority === "EMERGENCY") return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, 5);

  const percentFastCurrent =
    resolvedMonth
      .map((c) => asDays((c.resolvedAt || c.updatedAt).getTime() - c.createdAt.getTime()))
      .filter((t) => t <= 2).length / (resolvedMonth.length || 1);

  let insightText = "Response times are steady compared to the 30-day average.";
  if (percentFastCurrent > 0.6) {
    insightText = `You are resolving ${Math.round(percentFastCurrent * 100)}% of complaints within 48 hours. Excellent operational speed!`;
  } else if (overdueComplaints > 3) {
    insightText = `Warning: You have ${overdueComplaints} overdue complaints. Prioritise the oldest urgent tickets first.`;
  }

  const isEmptyState = monthComplaints.length === 0;

  const metrics = [
    {
      label: "Pending Queue",
      value: pendingComplaints,
      icon: FileClock,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-700",
      valueCls: pendingComplaints > 5 ? "text-amber-600" : "text-slate-900",
      borderCls: "border-t-4 border-t-blue-600",
      sparkData: sparklinePending,
      sparkStroke: "#2563eb",
    },
    {
      label: "Overdue Tickets",
      value: overdueComplaints,
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      valueCls: overdueComplaints > 0 ? "text-red-600" : "text-slate-900",
      borderCls: "border-t-4 border-t-red-600",
      sparkData: [overdueComplaints > 0 ? overdueComplaints - 1 : 0, overdueComplaints],
      sparkStroke: "#dc2626",
    },
    {
      label: "Avg Response",
      value: `${avgResponseTimeDays.toFixed(1)}`,
      unit: "days",
      icon: Clock3,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-700",
      valueCls: "text-slate-900",
      borderCls: "border-t-4 border-t-slate-700",
      sparkData: sparklineResolved,
      sparkStroke: "#475569",
    },
    {
      label: "SLA Compliance",
      value: `${slaCompliance.toFixed(1)}`,
      unit: "%",
      icon: Activity,
      iconBg: slaCompliance > 90 ? "bg-emerald-100" : slaCompliance >= 70 ? "bg-amber-100" : "bg-red-100",
      iconColor: slaCompliance > 90 ? "text-emerald-700" : slaCompliance >= 70 ? "text-amber-600" : "text-red-600",
      valueCls: slaCompliance > 90 ? "text-emerald-600" : slaCompliance >= 70 ? "text-amber-600" : "text-red-600",
      borderCls: slaCompliance > 90 ? "border-t-4 border-t-emerald-500" : slaCompliance >= 70 ? "border-t-4 border-t-amber-500" : "border-t-4 border-t-red-500",
      sparkData: sparklineSLA,
      sparkStroke: slaCompliance > 90 ? "#10b981" : slaCompliance >= 70 ? "#f59e0b" : "#ef4444",
    },
  ];

  return (
    <div className="space-y-6 pb-24">

      <PageHeader
        portalType={`Management Portal · ${semester.name}`}
        title="Dashboard"
        subtitle={`Residency: ${scopeLabel}`}
        action={
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/warden/queue"
              className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              <ClipboardList className="h-4 w-4" /> Queue
            </Link>
            <Link
              href="/warden/analytics"
              className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              <BarChart2 className="h-4 w-4" /> Insights
            </Link>
          </div>
        }
      />

      {/* ── Metric cards ──────────────────────────────────────────────── */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`surface-card p-5 ${m.borderCls}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {m.label}
                  </p>
                  <p className={`text-4xl font-black tracking-tight ${m.valueCls}`}>
                    {m.value}
                    {m.unit && (
                      <span className="ml-1 text-lg font-semibold text-slate-400">{m.unit}</span>
                    )}
                  </p>
                </div>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.iconBg}`}>
                  <Icon className={`h-5 w-5 ${m.iconColor}`} />
                </span>
              </div>
              {!isEmptyState && <Sparkline data={m.sparkData} stroke={m.sparkStroke} />}
            </div>
          );
        })}
      </section>

      {/* ── Main content panels ───────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">

        {/* High Priority Queue */}
        <div className="lg:col-span-2 surface-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-red-50">
            <h2 className="flex items-center gap-2 text-sm font-bold text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Action Required — High Priority
            </h2>
            <Link
              href="/warden/queue?priority=EMERGENCY,URGENT"
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
            >
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1">
            {isEmptyState || highPriorityLatest.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-slate-400 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <Activity className="h-6 w-6 text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Inbox Zero!</p>
                <p className="text-xs max-w-[220px]">
                  No emergency or urgent complaints require immediate attention.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {highPriorityLatest.map((ticket) => {
                  const isOverdue = asDays(now.getTime() - ticket.createdAt.getTime()) > safeDays;
                  const isEmergency = ticket.priority === "EMERGENCY";
                  return (
                    <li
                      key={ticket.id}
                      className="group flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                            isEmergency ? "bg-red-500 animate-pulse" : "bg-amber-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {ticket.studentProfile?.user?.name || "Student"}
                            <span className="mx-1 text-slate-300">·</span>
                            <span className="text-slate-600 font-normal">{ticket.category}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {isOverdue ? (
                              <span className="text-red-500 font-semibold">Overdue · </span>
                            ) : null}
                            Submitted {new Date(ticket.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span
                          className={`status-badge ${
                            isEmergency ? "status-badge-emergency" : "status-badge-urgent"
                          }`}
                        >
                          {ticket.priority}
                        </span>
                        <Link
                          href={`/warden/complaints/${ticket.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          View
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Quick navigation cards */}
        <div className="flex flex-col gap-4">
          <Link
            href="/warden/queue"
            className="surface-card group flex flex-col p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-600 transition-colors">
                <ClipboardList className="h-4 w-4 text-blue-700 group-hover:text-white transition-colors" />
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              Complaint Queue
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Manage all tickets, apply filters, and update statuses.
            </p>
            <div className="mt-3 h-1 w-10 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          <Link
            href="/warden/analytics"
            className="surface-card group flex flex-col p-5 hover:border-red-200 hover:shadow-md cursor-pointer transition-all flex-1"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 group-hover:bg-red-600 transition-colors">
                <TrendingUp className="h-4 w-4 text-red-600 group-hover:text-white transition-colors" />
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-red-400 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-red-700 transition-colors">
              Management Insights
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Historical charts, category breakdowns, and semester reports.
            </p>
            <div className="mt-3 h-1 w-10 rounded-full bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          <Link
            href="/warden/reports"
            className="surface-card group flex flex-col p-5 hover:border-slate-400 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-slate-800 transition-colors">
                <BarChart2 className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-800 transition-colors">
              Generate Report
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Export semester PDF summary for management records.
            </p>
            <div className="mt-3 h-1 w-10 rounded-full bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </section>

      {/* ── AI Insight FAB ────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <details className="group relative">
          <summary className="flex h-14 w-14 cursor-pointer list-none items-center justify-center rounded-full shadow-xl ring-4 ring-blue-800/20 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)" }}
          >
            <Lightbulb className="h-6 w-6 text-amber-300" />
          </summary>
          <div className="absolute bottom-full right-0 mb-4 w-[320px] origin-bottom-right rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl opacity-0 scale-95 transition-all duration-300 ease-out group-open:opacity-100 group-open:scale-100">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <Lightbulb className="h-4 w-4 text-amber-600 fill-amber-500" />
              </span>
              <h4 className="text-sm font-bold text-slate-900">AI Intel</h4>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{insightText}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Auto-analysis · {semester.name}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
